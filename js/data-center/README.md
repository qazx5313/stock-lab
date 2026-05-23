# 前端資料中心

這個資料夾是資料入口的「主管層」。頁面不要直接猜資料來源，應該從 `DATA_CENTER` 拿資料。

- `index.js`: 建立 `DATA_CENTER` 主入口。
- `realtime.js`: 管盤中即時資料、台指期與只更新數字的刷新流程。
- `after-hours.js`: 管每日盤後資料、狀態、成交行情。
- `industry.js`: 管上市/上櫃類股、MoneyDJ 細分類、題材成分。
- `stock.js`: 管單一股票資料整合，統一即時、盤後、主檔欄位。

後續新增資料來源時，先加到對應 manager，再讓頁面使用 manager，不要把 API 判斷寫進頁面檔。
