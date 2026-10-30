# Asset forecasting notebooks

**Live website:** https://kollawat09.github.io/WEB_FORCAST/ ([dashboard](https://kollawat09.github.io/WEB_FORCAST/dashboard.html)) — daily forecasts from all 25 models. Source in [Web_deploy/](Web_deploy/).

This project contains 25 forecasting notebooks: ARIMA, SVR, XGBoost, LSTM and Transformer for BTC, S&P 500, USD/EUR, WTI and gold (XAU).

## Browse the results

Open a notebook on GitHub to view its code and saved tables and plots. GitHub displays saved results; it does not execute notebook cells.

| Asset | Notebooks | Source data |
| --- | --- | --- |
| BTC | [BTC_TEST](BTC_TEST/) | [Bitcoin Historical Data.csv](CSV/Bitcoin%20Historical%20Data.csv) |
| S&P 500 | [S&P_TEST](S%26P_TEST/) | [S&P 500 Historical Data.csv](CSV/S%26P%20500%20Historical%20Data.csv) |
| USD/EUR | [USD_TEST](USD_TEST/) | [USD_EUR_Historical.csv](CSV/USD_EUR_Historical.csv) |
| WTI | [WTI_TEST](WTI_TEST/) | [WTI_USD Historical Data.csv](CSV/WTI_USD%20Historical%20Data.csv) |
| XAU | [XAU_TEST](XAU_TEST/) | [XAU_USD Historical Data.csv](CSV/XAU_USD%20Historical%20Data.csv) |

All five XGBoost notebooks contain **Step 10.1 - Lag ranking by Train Gain**, with separate Top 10 tables for horizons 1, 3, 5, 7, 14, 21 and 30. Horizons follow each notebook's declared calendar. The rankings describe Train feature importance; they do not establish an optimal lookback length.

## Run locally

1. Clone or download the repository, keeping the folder structure and CSV files together.
2. Open JupyterLab from the project root and select a Python environment with the notebook's dependencies. Check the imports and displayed library versions in each notebook; some models require different libraries.
3. Review the configuration and data path, then run cells from top to bottom. Running model cells trains models and can take time.

The existing notebooks record local Python kernel names. Other machines may need to select their own installed kernel. Generated exports under `OUTPUT/`, temporary copies and checkpoints are excluded from uploads; notebook outputs remain embedded in the `.ipynb` files.
