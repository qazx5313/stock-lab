# stock-lab 第四階段 操作說明

第四階段：算技術指標 / 題材熱度 / 候選池，讓畫面全面真實化。

## 新增/異動檔案

| 檔案 | 狀態 | 用途 |
|---|---|---|
| `jobs/sb_common.py` | 新增 | 共用 Supabase 連線工具 |
| `jobs/backfill_history.py` | 新增 | 一次回補歷史收盤（指標需要歷史資料） |
| `jobs/compute_signals.py` | 新增 | 核心：算 MA/KD/MACD/RSI、題材熱度、候選池 |
| `.github/workflows/daily.yml` | 異動 | 每日抓取後自動接著算指標 |
| `.github/workflows/backfill.yml` | 新增 | 手動觸發歷史回補（跑一次） |
| `index.html` | 異動 | 題材、每日篩選改讀真實資料 |

---

## 步驟 1：上傳異動檔到 repo

把這 6 個檔（保持資料夾結構）上傳覆蓋到 `stock-lab` repo：

```
jobs/sb_common.py
jobs/backfill_history.py
jobs/compute_signals.py
.github/workflows/daily.yml      （覆蓋舊的）
.github/workflows/backfill.yml   （新增）
index.html                       （覆蓋舊的）
```

> 直接解壓 `stock-lab-phase4.zip` 整包覆蓋上傳最省事。

---

## 步驟 2：跑一次歷史回補（重要，第四階段關鍵）

技術指標（MA20、KD、MACD…）需要歷史資料。你資料庫現在只有 1 天，
要先補歷史：

1. repo → **Actions** 分頁
2. 左側選 **歷史資料回補（手動執行一次）**
3. 右側 **Run workflow** → days 預設 `120`（要更準可改 `250`）→ 綠色 **Run workflow**
4. 這支會跑比較久（120 日約 5～10 分鐘，因為對交易所逐日節流抓取）
5. 跑完會自動接著算一次指標

> 跑完看 log 結尾：`回補結束：有效交易日 NN，上市 XXXX 筆 / 上櫃 XXXX 筆`
> 以及 `compute_signals 完成`。

---

## 步驟 3：確認資料表有東西

Supabase → Table Editor，確認這幾張表有資料：

| 表 | 預期 |
|---|---|
| `daily_prices` | 筆數大增（多了幾十個交易日 × 數千檔） |
| `daily_signals` | 最近交易日每檔一筆（含評分、tags） |
| `themes` | 數個題材，有 heat_score |
| `theme_stocks` | 題材成分股 |
| `candidate_pool` | 最近交易日約 40 檔 |

---

## 步驟 4：看網頁

開 `https://qazx5313.github.io/stock-lab/` → 強制重整（Ctrl+F5）

頂端橫幅應變成：
`✅ 已連線真實資料 · 交易日 2026/05/15 · 上漲 X / 下跌 Y · 題材 N · 候選 M`

此時應該變真實的：

- 首頁「強勢題材」表（從真實 themes 來）
- 首頁「精選觀察股」（當日漲幅前 8）
- 「每日篩選」結果（從 candidate_pool 綜合分排序）
- 頂端漲跌家數

仍是範例（之後階段處理）：

- 產業鏈圖（需要更完整的供應鏈對應表，第四階段後續可在後台維護）
- 個股分析的 K 線（第四階段後續：個股點進去讀該檔歷史價）
- AI 模擬實驗室（第五階段）

---

## 之後每天會自動

平日 14:30、16:15：抓盤後資料 → 自動接著算指標/題材/候選池。
你不用做任何事，網頁隔天就是最新的。

---

## 常見狀況

- **回補某些日子顯示「無資料」**：那天是假日/休市，正常跳過。
- **題材數量少**：歷史資料越多、分類越準。先用規則版（產業別＋漲幅量能）。
- **指標看起來怪**：回補天數不足時 MA60/MACD 會偏少，補到 120+ 日就準。
- **想擴充題材分類規則**：`jobs/compute_signals.py` 最上面
  `INDUSTRY_THEME` / `SYMBOL_THEME` 兩個對照表可自行增修。

跑完步驟 2、4，把 Actions log 結尾與網頁橫幅貼給我，確認無誤後進第五階段
（3 個 AI 機器人回測 → 模擬交易 → 檢討）。
