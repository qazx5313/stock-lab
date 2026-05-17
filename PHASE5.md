# stock-lab 第五階段 操作說明

第五階段：AI 量化模擬操盤實驗室（3 個 AI 機器人完整跑起來）。

## 新增/異動檔案

| 檔案 | 狀態 | 用途 |
|---|---|---|
| `jobs/run_ai_lab.py` | 新增 | AI 選股→回測→FinMind→模擬交易→檢討→升版 |
| `.github/workflows/daily.yml` | 異動 | 每日計算後自動接著跑 AI 實驗室 |
| `index.html` | 異動 | AI 實驗室頁改讀真實 ai_* 資料 |

---

## 步驟 1：設定 FinMind Token（GitHub Secret）

你已註冊 FinMind 拿到 token。到：

repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Name（完全照打） | Value |
|---|---|
| `FINMIND_TOKEN` | 你的 FinMind token |

> 沒設也能跑（流程完整，只是跳過 FinMind 深查）。設了才會在「回測通過的股」呼叫 FinMind 查證。

---

## 步驟 2：上傳異動檔

解壓 `stock-lab-phase5.zip` 整包覆蓋上傳到 repo（保持資料夾結構）。
重點是這 3 個：

```
jobs/run_ai_lab.py
.github/workflows/daily.yml   （覆蓋）
index.html                    （覆蓋）
```

---

## 步驟 3：手動跑一次完整流程

repo → **Actions** → **每日盤後抓取與計算** → **Run workflow**

會依序跑 3 步：
1. 抓取盤後資料
2. 計算技術指標/題材/候選池
3. **AI 量化模擬實驗室**（第五階段新增）

看 log 第 3 步，每個 AI 會印：

```
--- AI #1 題材量化AI（theme_quant）---
  選股：X / Y 檔通過策略
  回測：N 檔，通過門檻 M 檔
  FinMind 深入查證：M 檔（本次 FinMind 呼叫 K 次）
  模擬交易：買進 P 檔，動用資金 ...
  檢討完成，現金 ... / 持股市值 ...
```

3 個 AI 都跑完即成功。

---

## 步驟 4：看網頁

開網頁強制重整（Ctrl+F5）。橫幅會變成：

```
✅ 已連線真實資料 · 交易日 2026/05/15 · 上漲 X / 下跌 Y · 題材 N · 候選 M · AI 3
```

進「AI 模擬實驗室」頁：

- 3 個 AI 機器人卡片 → 真實的累積報酬、現金、持股市值
- 點進機器人 → 真實的選股、回測（勝率/盈虧比/樣本）、持股、買賣紀錄、自我檢討

---

## 回測門檻（你原規格）

通過需同時滿足：勝率 ≥ 60% **且** 樣本 ≥ 20 **且** 盈虧比 ≥ 1.5。
只有通過的股才會呼叫 FinMind（避免吃免費額度）。

可調整環境變數（daily.yml 內，或加 Secret）：

| 變數 | 預設 | 說明 |
|---|---|---|
| `FINMIND_MAX_CALLS` | 8 | 每次最多查幾檔，保護免費額度 |
| `FINMIND_THROTTLE` | 2 | 每次 FinMind 呼叫間隔秒數 |

---

## 三個 AI 策略（schema 種子已建）

| AI | 選股邏輯 |
|---|---|
| 題材量化 AI | 題材分 ≥ 65 且 量能分 ≥ 60 |
| 技術突破 AI | 技術分 ≥ 70 且（均線多頭 或 爆量） |
| 成長基本面 AI | 籌碼分 ≥ 70 且 綜合分 ≥ 65 |

多 AI 互評（ChatGPT/Gemini 欄位）已在 `ai_reviews` 表預留，
未來接 OpenAI/Gemini API 即可，現在用規則模板產自我檢討。

---

## 常見狀況

- **某 AI 通過門檻 0 檔**：正常，代表當天沒有股票同時滿足三個嚴格條件。
  歷史資料越多、市場越強時通過數會增加。
- **FinMind 呼叫 0 次**：若沒股票通過門檻就不會呼叫（設計如此），或未設 token。
- **FinMind `_error`**：額度用完或 token 錯，會記在 `ai_deep_analysis.finmind_data_used`，
  不影響主流程。
- **想調整策略鬆緊**：`jobs/run_ai_lab.py` 的 `strategy_pick()` 函式可改門檻。

---

## 全系統完成度

| 階段 | 狀態 |
|---|---|
| 一 UI 骨架 | ✅ |
| 二 資料庫 18 表 | ✅ |
| 三 盤後抓取 | ✅ |
| 四 指標/題材/候選池 | ✅ |
| 五 AI 模擬實驗室 | ✅（本階段） |

之後每天平日盤後會自動跑完整管線（抓取→計算→AI），你不用做任何事。
產業鏈圖、個股 K 線可在後續微調為讀個股歷史；多 AI 互評待接 API。
