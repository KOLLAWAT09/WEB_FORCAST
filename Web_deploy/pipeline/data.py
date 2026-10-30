"""Download daily prices from Yahoo Finance and keep one CSV per asset."""
import datetime as dt

import numpy as np
import pandas as pd

from .config import ASSETS, HISTORY_START, PRICE_DIR

COLUMNS = ['Open', 'High', 'Low', 'Close', 'Volume']


def fetch_asset(key: str) -> pd.DataFrame:
    import yfinance as yf

    ticker = ASSETS[key]['ticker']
    raw = yf.download(ticker, start=HISTORY_START, interval='1d', auto_adjust=False,
                      progress=False, multi_level_index=False, threads=False)
    if raw is None or raw.empty:
        raise RuntimeError(f'{key}: Yahoo Finance returned no rows for {ticker}')
    df = raw[COLUMNS].copy()
    df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
    df.index.name = 'Date'
    df = df[~df.index.duplicated(keep='last')].sort_index()
    if ASSETS[key].get('fx_close_fix'):
        # Yahoo's daily FX "Close" is a snapshot near the start of the day; the next bar's Open
        # is the end-of-day rate (matches investing.com with return correlation ~0.94 vs ~0.04).
        df['Close'] = df['Open'].shift(-1)
        df['High'] = df[['High', 'Close']].max(axis=1)
        df['Low'] = df[['Low', 'Close']].min(axis=1)
    df = df[np.isfinite(df['Close']) & df['Close'].gt(0)]
    # Today's bar is still forming (BTC trades 24/7, FX/futures nearly so): keep completed days only.
    today_utc = pd.Timestamp(dt.datetime.now(dt.timezone.utc).date())
    df = df[df.index < today_utc]
    if ASSETS[key]['calendar'] == 'B':
        df = df[df.index.dayofweek < 5]
    for col in ['Open', 'High', 'Low']:
        df[col] = df[col].where(np.isfinite(df[col]) & df[col].gt(0), df['Close'])
    df['Volume'] = df['Volume'].fillna(0)
    return df


def update_prices(keys=None) -> dict:
    PRICE_DIR.mkdir(parents=True, exist_ok=True)
    report = {}
    for key in keys or ASSETS:
        df = fetch_asset(key)
        path = PRICE_DIR / f'{key}.csv'
        if path.exists():
            old = load_prices(key)
            # Yahoo sometimes drops old rows on a bad response; never shrink the history.
            if len(df) < 0.95 * len(old):
                raise RuntimeError(f'{key}: download has {len(df)} rows, stored file has {len(old)}')
        df.to_csv(path, float_format='%.6f')
        report[key] = dict(rows=len(df), last=str(df.index[-1].date()))
        print(f'{key}: {len(df)} rows, last {df.index[-1].date()}', flush=True)
    return report


def load_prices(key: str) -> pd.DataFrame:
    df = pd.read_csv(PRICE_DIR / f'{key}.csv', parse_dates=['Date'], index_col='Date')
    assert df.index.is_monotonic_increasing and df.index.is_unique
    assert df['Close'].gt(0).all()
    return df
