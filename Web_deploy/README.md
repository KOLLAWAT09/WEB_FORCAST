# Asset Forecast Lab — เว็บไซต์พยากรณ์ราคา

เว็บไซต์พยากรณ์ราคา 5 สินทรัพย์ (BTC, S&P 500, USD/EUR, WTI, XAU) ด้วย 5 โมเดล (ARIMA, SVR, XGBoost, LSTM, PatchTST) ที่ย้ายมาจาก notebook ใน `*_TEST/` ข้อมูลอัปเดตทุกวันจาก Yahoo Finance

- `site/index.html` — หน้าแนะนำวิธีใช้งาน
- `site/dashboard.html` — เลือกสินทรัพย์, เลือกโมเดล (หลายตัวพร้อมกัน), เลือกระยะพยากรณ์ h, ดูกราฟตลาด กราฟพยากรณ์ ตารางความแม่นยำ และราคาพยากรณ์ 30 วัน

## โครงสร้าง

| Path | หน้าที่ |
| --- | --- |
| `pipeline/config.py` | สินทรัพย์, ticker และ hyperparameter ของแต่ละโมเดล (ตาม notebook) |
| `pipeline/data.py` | ดึงราคาปิดรายวันจาก Yahoo Finance → `data/prices/*.csv` |
| `pipeline/models.py` | 5 โมเดล ใช้ fit/predict รูปแบบเดียวกัน |
| `pipeline/run.py` | คำสั่ง `fetch`, `train`, `predict`, `all` |
| `artifacts/` | โมเดลที่ train แล้ว (สร้างอัตโนมัติ ไม่ commit) |
| `site/data/*.json` | ข้อมูลที่หน้าเว็บอ่าน (สร้างอัตโนมัติ ไม่ commit) |
| `../.github/workflows/forecast-site.yml` | รันทุกวัน 07:30 น. เวลาไทย แล้ว deploy ขึ้น GitHub Pages |

## รันบนเครื่อง

```bash
cd Web_deploy
pip install -r requirements.txt torch
python -m pipeline.run all
python -m http.server 8765 --directory site
```

แล้วเปิด http://localhost:8765 ถ้าต้องการรันแค่บางส่วนให้ใช้ `--assets BTC,XAU` หรือ `--models ARIMA,SVR`

## Deploy (GitHub Pages)

1. Push repo ขึ้น GitHub
2. ไปที่ **Settings → Pages → Build and deployment → Source** แล้วเลือก **GitHub Actions**
3. ไปที่ **Actions → Update forecasts and deploy site → Run workflow** เพื่อรันครั้งแรก ซึ่งจะ train ทั้ง 25 โมเดล ใช้เวลาประมาณ 20 นาที

หลังจากนั้นระบบจะทำงานเองทุกวัน ดึงราคาใหม่และพยากรณ์ด้วยโมเดลที่เก็บไว้ (เก็บใน Actions cache) ทุกวันอาทิตย์จะ retrain ทั้ง 25 โมเดล และถ้าต้องการ retrain เองก็กด Run workflow แล้วติ๊ก `retrain` ได้

## วิธีการ (เหมือน notebook)

- ใช้ข้อมูลตั้งแต่ 1 ก.ค. 2021 แบ่ง train/test แบบ 80/20 ตามลำดับเวลา โมเดลเห็นเฉพาะข้อมูลช่วง train
- ใช้ log price กับ ARIMA และใช้ log return กับโมเดลอื่น โดย scaler ที่ใช้ fit จากช่วง train เท่านั้น
- SVR และ XGBoost เป็นแบบ direct คือ train แยก 1 โมเดลต่อ 1 ระยะ h (1–30) ส่วน LSTM และ PatchTST เป็นแบบ MIMO พยากรณ์ 30 ระยะพร้อมกัน และเฉลี่ยผลจาก 5 seeds
- ทดสอบด้วย rolling origin ในช่วง test โดยตรึงพารามิเตอร์ไว้ (frozen) ช่วง test จะยาวขึ้นทุกวันเมื่อมีราคาจริงเข้ามาเพิ่ม
- วัดผลด้วย MAPE, RMSE, MAE และอัตราทายทิศทางถูก ช่วง 95% คำนวณจาก quantile 2.5%/97.5% ของ error จริงในช่วง test ของแต่ละ h
- ระยะ h ของ BTC นับเป็นวันปฏิทิน ส่วนสินทรัพย์อื่นนับเป็นวันทำการ (จันทร์–ศุกร์)

## ข้อแตกต่างจาก notebook

- **แหล่งข้อมูล:** notebook ใช้ CSV จาก investing.com แต่ investing.com ไม่มี API และห้ามดึงข้อมูลอัตโนมัติ เว็บนี้จึงใช้ Yahoo Finance แทน
  - BTC และ S&P 500 ตรงกับ investing.com เกือบ 100%
  - USD/EUR ใช้ `EUR=X` แล้วปรับ close เป็น open ของวันถัดไป หลังปรับแล้ว return มี correlation กับ investing.com 0.94
  - WTI (`CL=F`) และทองคำ (`GC=F`) เป็นราคา futures ไม่ใช่ spot ระดับราคาต่างจาก investing.com เฉลี่ยประมาณ 0.4–0.5%
- **LSTM:** notebook ใช้ TensorFlow/Keras ส่วนเว็บนี้ย้ายมาใช้ PyTorch โครงสร้างเดียวกัน (64→32→Dense 30) และตั้งค่า initializer ให้เหมือน Keras ผลจึงใกล้เคียงแต่ไม่ตรงกันทุกหลัก
- **ARIMA:** ถ้าไม่มีตัวเลือกไหนผ่าน Ljung–Box notebook จะหยุดทำงาน แต่เว็บจะใช้ตัวที่ AIC ต่ำสุดแทน แล้วบันทึกไว้ใน `diagnostics_passed`

เว็บไซต์นี้ทำขึ้นเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน
