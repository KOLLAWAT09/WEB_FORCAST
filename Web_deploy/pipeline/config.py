"""Asset and model settings, taken from the 25 notebooks in *_TEST/."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRICE_DIR = ROOT / 'data' / 'prices'
ARTIFACT_DIR = ROOT / 'artifacts'
SITE_DATA_DIR = ROOT / 'site' / 'data'

# Same history start as the investing.com CSVs used by the notebooks.
HISTORY_START = '2021-07-01'
TRAIN_RATIO = 0.8
HORIZONS = [1, 3, 5, 7, 14, 21, 30]
MAX_H = 30
ALPHA = 0.05

# calendar: 'D' = every calendar day (BTC notebooks use asfreq('D')),
# 'B' = Mon-Fri observation steps (S&P, USD, WTI, XAU notebooks).
# lookback values follow each notebook's LOOKBACK constant.
ASSETS = {
    'BTC': dict(name='Bitcoin', name_th='บิตคอยน์', pair='BTC/USD', ticker='BTC-USD',
                unit='USD', calendar='D', decimals=2,
                lookback=dict(SVR=60, XGBOOST=40, LSTM=60, TRANSFORMER=60),
                lstm=dict(epochs=13, dropout=0.3, lr=1e-3)),
    'SNP': dict(name='S&P 500', name_th='ดัชนี S&P 500', pair='S&P 500', ticker='^GSPC',
                unit='points', calendar='B', decimals=2,
                lookback=dict(SVR=60, XGBOOST=40, LSTM=60, TRANSFORMER=60),
                lstm=dict(epochs=50, dropout=0.1, lr=1e-3)),
    'USD': dict(name='US Dollar / Euro', name_th='ดอลลาร์สหรัฐ / ยูโร', pair='USD/EUR', ticker='EUR=X',
                unit='EUR', calendar='B', decimals=4, fx_close_fix=True,
                lookback=dict(SVR=40, XGBOOST=40, LSTM=40, TRANSFORMER=40),
                lstm=dict(epochs=50, dropout=0.1, lr=1e-3)),
    'WTI': dict(name='WTI Crude Oil', name_th='น้ำมันดิบ WTI', pair='WTI/USD', ticker='CL=F',
                unit='USD', calendar='B', decimals=2,
                lookback=dict(SVR=40, XGBOOST=40, LSTM=40, TRANSFORMER=40),
                lstm=dict(epochs=50, dropout=0.1, lr=1e-3)),
    'XAU': dict(name='Gold', name_th='ทองคำ', pair='XAU/USD', ticker='GC=F',
                unit='USD', calendar='B', decimals=2,
                lookback=dict(SVR=40, XGBOOST=40, LSTM=40, TRANSFORMER=40),
                lstm=dict(epochs=50, dropout=0.1, lr=1e-3)),
}

MODELS = ['ARIMA', 'SVR', 'XGBOOST', 'LSTM', 'TRANSFORMER']

ARIMA_SETTINGS = dict(max_p=5, max_q=5, max_d=2, top_k=3, lb_lags=[10, 20, 30])
SVR_SETTINGS = dict(kernel='rbf', gamma='scale', knn_k=3)
XGB_SETTINGS = dict(objective='reg:squarederror', n_estimators=100, learning_rate=0.3, max_depth=6,
                    min_child_weight=1, gamma=0, subsample=1.0, colsample_bytree=1.0, reg_lambda=1.0,
                    reg_alpha=0.0, tree_method='hist', random_state=0, n_jobs=2)
LSTM_SETTINGS = dict(units=[64, 32], batch_size=32, seeds=[0, 1, 2, 3, 4])
PATCHTST_SETTINGS = dict(patch_len=16, stride=8, n_layers=3, n_heads=4, d_model=16, d_ff=128,
                         dropout=0.3, head_dropout=0.0, revin=True, learning_rate=1e-4,
                         batch_size=128, epochs=100, pct_start=0.3, seeds=[0, 1, 2, 3, 4])
