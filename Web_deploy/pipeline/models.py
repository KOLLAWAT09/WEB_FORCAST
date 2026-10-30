"""The five forecasting models, ported from the *_TEST notebooks.

Every model shares one contract:
    fit(log_price, n_train, asset_cfg) -> state     (uses rows [0, n_train) only)
    predict(state, log_price, origins) -> (len(origins), MAX_H) array
        cumulative log return from each origin to origin+1 .. origin+MAX_H,
        using only rows <= origin. Parameters stay frozen after fit, as in the notebooks.
"""
import random
import warnings

import numpy as np
from sklearn.preprocessing import StandardScaler

from .config import (ALPHA, ARIMA_SETTINGS, LSTM_SETTINGS, MAX_H, PATCHTST_SETTINGS,
                     SVR_SETTINGS, XGB_SETTINGS)


def log_returns(log_price):
    return np.r_[np.nan, np.diff(log_price)]


def window_index(origins, lookback):
    """Rows origin-lookback+1 .. origin, oldest first."""
    idx = np.asarray(origins)[:, None] - np.arange(lookback - 1, -1, -1)[None, :]
    assert idx.min() >= 1, 'window reaches the undefined first return'
    return idx


def fit_return_scaler(returns, n_train):
    return StandardScaler().fit(returns[1:n_train, None])


def scaled(returns, scaler):
    z = np.full(len(returns), np.nan)
    z[1:] = scaler.transform(returns[1:, None]).ravel()
    return z


# ---------------------------------------------------------------- ARIMA
def fit_arima(log_price, n_train, cfg):
    from statsmodels.stats.diagnostic import acorr_ljungbox
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.stattools import adfuller, kpss

    s = ARIMA_SETTINGS
    train = log_price[:n_train]
    d = None
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        for candidate in range(s['max_d'] + 1):
            values = np.diff(train, n=candidate) if candidate else train
            if adfuller(values, autolag='AIC')[1] < ALPHA and kpss(values, regression='c', nlags='auto')[1] > ALPHA:
                d = candidate
                break
    d = 1 if d is None else d
    trends = ['n', 'c'] if d == 0 else (['n', 't'] if d == 1 else ['n'])
    fits = []
    for p in range(s['max_p'] + 1):
        for q in range(s['max_q'] + 1):
            for trend in trends:
                try:
                    with warnings.catch_warnings():
                        warnings.simplefilter('ignore')
                        res = ARIMA(train, order=(p, d, q), trend=trend).fit()
                except Exception:
                    continue
                if res.mle_retvals.get('converged', False) and np.isfinite(res.aic):
                    fits.append((res.aic, res.bic, p, q, trend, res))
    fits.sort(key=lambda r: (r[0], r[1]))
    top = fits[:s['top_k']]
    # Notebook rule: lowest-AIC Top-3 candidate passing Ljung-Box (10/20/30) and root checks.
    chosen, passed = top[0], False
    for row in top:
        res = row[5]
        roots = np.r_[res.arroots, res.maroots]
        roots_ok = bool(np.isfinite(roots).all() and (np.abs(roots) > 1).all())
        resid = res.resid[d:]
        k = row[2] + row[3]
        lags = [lag for lag in s['lb_lags'] if lag > k]
        lb = acorr_ljungbox(resid, lags=lags, model_df=k, return_df=True)
        if roots_ok and (lb['lb_pvalue'] > ALPHA).all():
            chosen, passed = row, True
            break
    aic, bic, p, q, trend, res = chosen
    return dict(order=(p, d, q), trend=trend, params=np.asarray(res.params), aic=float(aic),
                bic=float(bic), diagnostics_passed=passed,
                label=f'ARIMA({p},{d},{q}) trend={trend}')


def predict_arima(state, log_price, origins):
    from statsmodels.tsa.arima.model import ARIMA

    out = np.empty((len(origins), MAX_H))
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        model = ARIMA(log_price, order=state['order'], trend=state['trend'])
        full = model.filter(state['params'])
        for i, origin in enumerate(origins):
            res = full.apply(log_price[:origin + 1], refit=False)
            out[i] = np.asarray(res.forecast(MAX_H)) - log_price[origin]
    return out


# ---------------------------------------------------------------- direct per-horizon models
def _direct_training_set(features, log_price, n_train, lookback, h):
    origins = np.arange(lookback, n_train - h)
    X = features[window_index(origins, lookback)]
    y = log_price[origins + h] - log_price[origins]
    return X, y


def fit_svr(log_price, n_train, cfg):
    from sklearn.neighbors import NearestNeighbors
    from sklearn.svm import SVR

    lookback = cfg['lookback']['SVR']
    returns = log_returns(log_price)
    scaler = fit_return_scaler(returns, n_train)
    z = scaled(returns, scaler)
    models = {}
    k = SVR_SETTINGS['knn_k']
    for h in range(1, MAX_H + 1):
        X, y = _direct_training_set(z, log_price, n_train, lookback, h)
        target_scaler = StandardScaler().fit(y[:, None])
        ys = target_scaler.transform(y[:, None]).ravel()
        # Analytical C / epsilon from the notebooks (Cherkassky-Ma rule with kNN noise estimate).
        neighbors = NearestNeighbors(n_neighbors=k + 1).fit(X).kneighbors(X, return_distance=False)
        others = np.stack([v[v != i][:k] for i, v in enumerate(neighbors)])
        mse_knn = np.mean((ys - ys[others].mean(axis=1)) ** 2)
        a = len(y) ** 0.2 * k
        sigma = np.sqrt(a / (a - 1) * mse_knn)
        C = max(abs(ys.mean() + 3 * ys.std()), abs(ys.mean() - 3 * ys.std()))
        epsilon = 3 * sigma * np.sqrt(np.log(len(y)) / len(y))
        model = SVR(kernel=SVR_SETTINGS['kernel'], gamma=SVR_SETTINGS['gamma'], C=C, epsilon=epsilon)
        model.fit(X, ys)
        models[h] = (model, target_scaler)
    return dict(lookback=lookback, scaler=scaler, models=models)


def predict_svr(state, log_price, origins):
    z = scaled(log_returns(log_price), state['scaler'])
    X = z[window_index(origins, state['lookback'])]
    out = np.empty((len(origins), MAX_H))
    for h, (model, target_scaler) in state['models'].items():
        out[:, h - 1] = target_scaler.inverse_transform(model.predict(X)[:, None]).ravel()
    return out


def fit_xgboost(log_price, n_train, cfg):
    from xgboost import XGBRegressor

    lookback = cfg['lookback']['XGBOOST']
    returns = log_returns(log_price)
    models = {}
    for h in range(1, MAX_H + 1):
        X, y = _direct_training_set(returns, log_price, n_train, lookback, h)
        model = XGBRegressor(**XGB_SETTINGS)
        model.fit(X, y, verbose=False)
        models[h] = model
    return dict(lookback=lookback, models=models)


def predict_xgboost(state, log_price, origins):
    X = log_returns(log_price)[window_index(origins, state['lookback'])]
    out = np.empty((len(origins), MAX_H))
    for h, model in state['models'].items():
        out[:, h - 1] = model.predict(X)
    return out


# ---------------------------------------------------------------- MIMO neural models (PyTorch)
def _torch():
    import torch
    torch.set_num_threads(2)
    return torch


def _set_seed(torch, seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def _mimo_training_set(z, n_train, lookback):
    origins = np.arange(lookback, n_train - MAX_H)
    X = z[window_index(origins, lookback)][..., None].astype(np.float32)
    y = z[origins[:, None] + np.arange(1, MAX_H + 1)[None, :]].astype(np.float32)
    return X, y


def _build_lstm(torch, lookback, dropout):
    nn = torch.nn
    units = LSTM_SETTINGS['units']

    class LSTMForecaster(nn.Module):
        """Keras Sequential(LSTM(64, seq) -> Dropout -> LSTM(32) -> Dropout -> Dense(30))."""

        def __init__(self):
            super().__init__()
            self.lstm1 = nn.LSTM(1, units[0], batch_first=True)
            self.lstm2 = nn.LSTM(units[0], units[1], batch_first=True)
            self.drop = nn.Dropout(dropout)
            self.head = nn.Linear(units[1], MAX_H)
            # Keras initialisers: glorot kernels, orthogonal recurrent weights, forget-gate bias 1.
            for lstm in (self.lstm1, self.lstm2):
                for name, param in lstm.named_parameters():
                    if 'weight_ih' in name:
                        nn.init.xavier_uniform_(param)
                    elif 'weight_hh' in name:
                        nn.init.orthogonal_(param)
                    else:
                        nn.init.zeros_(param)
                        hidden = param.shape[0] // 4
                        if 'bias_ih' in name:
                            param.data[hidden:2 * hidden] = 1.0
            nn.init.xavier_uniform_(self.head.weight)
            nn.init.zeros_(self.head.bias)

        def forward(self, x):
            x, _ = self.lstm1(x)
            x, _ = self.lstm2(self.drop(x))
            return self.head(self.drop(x[:, -1, :]))

    return LSTMForecaster()


def _build_patchtst(torch, lookback):
    nn = torch.nn
    s = PATCHTST_SETTINGS
    D, H, P, S = s['d_model'], s['n_heads'], s['patch_len'], s['stride']
    patch_count = (lookback + S - P) // S + 1

    class PatchEncoderBlock(nn.Module):
        def __init__(self):
            super().__init__()
            self.head_dim = D // H
            self.qkv = nn.Linear(D, 3 * D)
            self.project = nn.Sequential(nn.Linear(D, D), nn.Dropout(s['dropout']))
            self.attention_residual = nn.Dropout(s['dropout'])
            self.bn_attention = nn.BatchNorm1d(D)
            self.ff = nn.Sequential(nn.Linear(D, s['d_ff']), nn.GELU(), nn.Dropout(s['dropout']),
                                    nn.Linear(s['d_ff'], D))
            self.ff_residual = nn.Dropout(s['dropout'])
            self.bn_ff = nn.BatchNorm1d(D)

        def forward(self, x, previous_scores=None):
            batch, patches, _ = x.shape
            q, k, v = self.qkv(x).chunk(3, dim=-1)

            def heads(t):
                return t.reshape(batch, patches, H, self.head_dim).transpose(1, 2)

            q, k, v = heads(q), heads(k), heads(v)
            scores = (q @ k.transpose(-1, -2)) * (self.head_dim ** -0.5)
            if previous_scores is not None:
                scores = scores + previous_scores
            attended = (scores.softmax(dim=-1) @ v).transpose(1, 2).reshape(batch, patches, D)
            x = self.bn_attention((x + self.attention_residual(self.project(attended))).transpose(1, 2)).transpose(1, 2)
            x = self.bn_ff((x + self.ff_residual(self.ff(x))).transpose(1, 2)).transpose(1, 2)
            return x, scores

    class PatchTST(nn.Module):
        def __init__(self):
            super().__init__()
            self.pad = nn.ReplicationPad1d((0, S))
            self.embedding = nn.Linear(P, D)
            self.position = nn.Parameter(torch.empty(patch_count, D))
            nn.init.uniform_(self.position, -0.02, 0.02)
            self.embedding_dropout = nn.Dropout(s['dropout'])
            self.encoder = nn.ModuleList([PatchEncoderBlock() for _ in range(s['n_layers'])])
            self.head = nn.Sequential(nn.Flatten(start_dim=1), nn.Dropout(s['head_dropout']),
                                      nn.Linear(patch_count * D, MAX_H))

        def forward(self, x):
            mean = x.mean(dim=1, keepdim=True).detach()
            std = torch.sqrt(x.var(dim=1, keepdim=True, unbiased=False) + 1e-5).detach()
            normalized = (x - mean) / std if s['revin'] else x
            patches = self.pad(normalized.transpose(1, 2)).unfold(-1, P, S).squeeze(1)
            encoded = self.embedding_dropout(self.embedding(patches) + self.position)
            scores = None
            for block in self.encoder:
                encoded, scores = block(encoded, scores)
            predicted = self.head(encoded.transpose(1, 2))
            if s['revin']:
                predicted = predicted * std[:, 0, :] + mean[:, 0, :]
            return predicted

    return PatchTST()


def _train_mimo(kind, log_price, n_train, cfg):
    torch = _torch()
    from torch.utils.data import DataLoader, TensorDataset

    lookback = cfg['lookback'][kind]
    returns = log_returns(log_price)
    scaler = fit_return_scaler(returns, n_train)
    X, y = _mimo_training_set(scaled(returns, scaler), n_train, lookback)
    dataset = TensorDataset(torch.from_numpy(X), torch.from_numpy(y))
    if kind == 'LSTM':
        seeds, epochs = LSTM_SETTINGS['seeds'], cfg['lstm']['epochs']
        batch, lr = LSTM_SETTINGS['batch_size'], cfg['lstm']['lr']
    else:
        s = PATCHTST_SETTINGS
        seeds, epochs, batch, lr = s['seeds'], s['epochs'], s['batch_size'], s['learning_rate']
    weights, losses = [], []
    for seed in seeds:
        _set_seed(torch, seed)
        loader = DataLoader(dataset, batch_size=batch, shuffle=True,
                            generator=torch.Generator().manual_seed(seed))
        model = (_build_lstm(torch, lookback, cfg['lstm']['dropout']) if kind == 'LSTM'
                 else _build_patchtst(torch, lookback))
        optimizer = torch.optim.Adam(model.parameters(), lr=lr)
        scheduler = None
        if kind == 'TRANSFORMER':
            scheduler = torch.optim.lr_scheduler.OneCycleLR(
                optimizer, max_lr=lr, pct_start=PATCHTST_SETTINGS['pct_start'],
                epochs=epochs, steps_per_epoch=len(loader))
        loss_fn = torch.nn.MSELoss()
        for _ in range(epochs):
            model.train()
            total = 0.0
            for inputs, targets in loader:
                optimizer.zero_grad(set_to_none=True)
                loss = loss_fn(model(inputs), targets)
                loss.backward()
                optimizer.step()
                if scheduler is not None:
                    scheduler.step()
                total += loss.item() * len(inputs)
        losses.append(total / len(dataset))
        weights.append({k: v.detach().cpu().numpy() for k, v in model.state_dict().items()})
    return dict(kind=kind, lookback=lookback, scaler=scaler, seeds=seeds, weights=weights,
                dropout=cfg['lstm']['dropout'], final_train_mse=losses)


def _predict_mimo(state, log_price, origins):
    torch = _torch()
    z = scaled(log_returns(log_price), state['scaler'])
    X = torch.from_numpy(z[window_index(origins, state['lookback'])][..., None].astype(np.float32))
    seed_returns = []
    for weights in state['weights']:
        model = (_build_lstm(torch, state['lookback'], state['dropout']) if state['kind'] == 'LSTM'
                 else _build_patchtst(torch, state['lookback']))
        model.load_state_dict({k: torch.from_numpy(v) for k, v in weights.items()})
        model.eval()
        with torch.no_grad():
            pred = model(X).numpy()
        seed_returns.append(state['scaler'].inverse_transform(pred.reshape(-1, 1)).reshape(len(origins), MAX_H))
    # Equal-weight seed ensemble of daily returns, summed into cumulative log returns.
    return np.cumsum(np.mean(seed_returns, axis=0), axis=1)


REGISTRY = {
    'ARIMA': (fit_arima, predict_arima),
    'SVR': (fit_svr, predict_svr),
    'XGBOOST': (fit_xgboost, predict_xgboost),
    'LSTM': (lambda lp, n, cfg: _train_mimo('LSTM', lp, n, cfg), _predict_mimo),
    'TRANSFORMER': (lambda lp, n, cfg: _train_mimo('TRANSFORMER', lp, n, cfg), _predict_mimo),
}
