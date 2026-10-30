"""Command line entry point.

    python -m pipeline.run fetch            # download latest prices from Yahoo Finance
    python -m pipeline.run train            # refit all 25 models (weekly)
    python -m pipeline.run predict          # forecast with stored models, write site/data/*.json (daily)
    python -m pipeline.run all              # fetch + train + predict

Add --assets BTC,XAU and/or --models ARIMA,SVR to limit the run.
"""
import argparse
import datetime as dt
import json
import time

import joblib
import numpy as np
import pandas as pd

from .config import (ARTIFACT_DIR, ASSETS, HORIZONS, MAX_H, MODELS, SITE_DATA_DIR, TRAIN_RATIO)
from .data import load_prices, update_prices
from .models import REGISTRY


def now_utc():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def artifact_path(asset, model):
    return ARTIFACT_DIR / asset / f'{model}.joblib'


def train(assets, models):
    for asset in assets:
        cfg = ASSETS[asset]
        df = load_prices(asset)
        log_price = np.log(df['Close'].to_numpy())
        n_train = int(TRAIN_RATIO * len(df))
        for model in models:
            started = time.perf_counter()
            fit, _ = REGISTRY[model]
            state = fit(log_price, n_train, cfg)
            meta = dict(asset=asset, model=model, trained_at=now_utc(), n_rows=len(df), n_train=n_train,
                        train_start=str(df.index[0].date()), train_end=str(df.index[n_train - 1].date()))
            path = artifact_path(asset, model)
            path.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump(dict(meta=meta, state=state), path, compress=3)
            print(f'train {asset}/{model}: {time.perf_counter() - started:.1f}s', flush=True)


def future_dates(last_date, calendar):
    start = last_date + pd.Timedelta(days=1)
    if calendar == 'D':
        return pd.date_range(start, periods=MAX_H, freq='D')
    return pd.bdate_range(start, periods=MAX_H)


def round_list(values, digits):
    return [None if not np.isfinite(v) else round(float(v), digits) for v in values]


def evaluate(asset, model, df, cfg):
    bundle = joblib.load(artifact_path(asset, model))
    meta, state = bundle['meta'], bundle['state']
    _, predict = REGISTRY[model]
    prices = df['Close'].to_numpy()
    log_price = np.log(prices)
    n = len(df)
    train_end = pd.Timestamp(meta['train_end'])
    n_train = int(df.index.get_indexer([train_end])[0]) + 1
    assert n_train > 0, f'{asset}/{model}: train end {train_end.date()} missing from price file'

    # Test origins start at the last Train row, as in the notebooks; the latest row is the live origin.
    origins = np.arange(n_train - 1, n)
    cum = predict(state, log_price, origins)
    digits = cfg['decimals'] + 2

    test, metrics, band = {}, [], {}
    for h in range(1, MAX_H + 1):
        valid = origins + h < n
        o = origins[valid]
        forecast = prices[o] * np.exp(cum[valid, h - 1])
        actual = prices[o + h]
        err = np.log(actual / forecast)
        if len(err) >= 20:
            band[h] = (float(np.quantile(err, 0.025)), float(np.quantile(err, 0.975)))
        else:
            band[h] = (np.nan, np.nan)
        if h not in HORIZONS or len(o) == 0:
            continue
        test[str(h)] = dict(first_origin=int(o[0]), forecast=round_list(forecast, digits))
        moved = np.sign(forecast - prices[o])
        hit = moved != 0
        da = float(np.mean(moved[hit] == np.sign(actual - prices[o])[hit]) * 100) if hit.sum() >= 10 else None
        metrics.append(dict(h=h, n=int(len(o)), rmse=float(np.sqrt(np.mean((actual - forecast) ** 2))),
                            mae=float(np.mean(np.abs(actual - forecast))),
                            mape=float(np.mean(np.abs((actual - forecast) / actual)) * 100),
                            da=da, da_n=int(hit.sum())))

    latest = cum[-1]
    future = prices[-1] * np.exp(latest)
    lo = np.array([future[h - 1] * np.exp(band[h][0]) for h in range(1, MAX_H + 1)])
    hi = np.array([future[h - 1] * np.exp(band[h][1]) for h in range(1, MAX_H + 1)])
    info = dict(meta)
    if model == 'ARIMA':
        info.update(spec=state['label'], aic=state['aic'], diagnostics_passed=state['diagnostics_passed'])
    elif 'lookback' in state:
        info.update(lookback=state['lookback'])
    return dict(info=info, metrics=metrics, test=test,
                future=dict(forecast=round_list(future, digits), lo95=round_list(lo, digits),
                            hi95=round_list(hi, digits)))


def predict(assets, models):
    SITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    index_path = SITE_DATA_DIR / 'index.json'
    index = json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else {'assets': {}}
    for asset in assets:
        cfg = ASSETS[asset]
        df = load_prices(asset)
        path = SITE_DATA_DIR / f'{asset}.json'
        payload = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'models': {}}
        results = payload.get('models', {})
        for model in models:
            if not artifact_path(asset, model).exists():
                # First run, or the CI cache was evicted: train this model now.
                print(f'{asset}/{model}: no trained artifact, training', flush=True)
                train([asset], [model])
            started = time.perf_counter()
            results[model] = evaluate(asset, model, df, cfg)
            print(f'predict {asset}/{model}: {time.perf_counter() - started:.1f}s', flush=True)
        dates = df.index.strftime('%Y-%m-%d').tolist()
        d = cfg['decimals'] + 2
        payload = dict(
            asset=asset, name=cfg['name'], name_th=cfg['name_th'], pair=cfg['pair'], ticker=cfg['ticker'],
            unit=cfg['unit'], decimals=cfg['decimals'], calendar=cfg['calendar'], horizons=HORIZONS,
            generated_at=now_utc(), last_date=dates[-1],
            prices=dict(date=dates, open=round_list(df['Open'], d), high=round_list(df['High'], d),
                        low=round_list(df['Low'], d), close=round_list(df['Close'], d),
                        volume=[int(v) for v in df['Volume'].fillna(0)]),
            future_dates=future_dates(df.index[-1], cfg['calendar']).strftime('%Y-%m-%d').tolist(),
            models={m: results[m] for m in MODELS if m in results})
        path.write_text(json.dumps(payload, separators=(',', ':'), allow_nan=False), encoding='utf-8')

        close = df['Close'].to_numpy()
        index['assets'][asset] = dict(
            name=cfg['name'], name_th=cfg['name_th'], pair=cfg['pair'], unit=cfg['unit'],
            decimals=cfg['decimals'], last_date=dates[-1], last_close=float(close[-1]),
            change_pct=float((close[-1] / close[-2] - 1) * 100),
            spark=round_list(close[-60:], d),
            models={m: dict(next=r['future']['forecast'][0],
                            mape_h1=next((x['mape'] for x in r['metrics'] if x['h'] == 1), None))
                    for m, r in payload['models'].items()})
    index['generated_at'] = now_utc()
    index['assets'] = {a: index['assets'][a] for a in ASSETS if a in index['assets']}
    index_path.write_text(json.dumps(index, separators=(',', ':'), allow_nan=False), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['fetch', 'train', 'predict', 'all'])
    parser.add_argument('--assets', default=','.join(ASSETS))
    parser.add_argument('--models', default=','.join(MODELS))
    args = parser.parse_args()
    assets = [a.strip().upper() for a in args.assets.split(',') if a.strip()]
    models = [m.strip().upper() for m in args.models.split(',') if m.strip()]
    assert set(assets) <= set(ASSETS), f'unknown asset in {assets}'
    assert set(models) <= set(MODELS), f'unknown model in {models}'
    if args.command in ('fetch', 'all'):
        update_prices(assets)
    if args.command in ('train', 'all'):
        train(assets, models)
    if args.command in ('predict', 'all'):
        predict(assets, models)


if __name__ == '__main__':
    main()
