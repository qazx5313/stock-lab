---
title: 技術資料庫與策略知識庫整併說明
version: 2026-05-26
type: technical_database_registry
---

# 技術資料庫與策略知識庫整併說明

本專案沒有另建第二套技術資料庫。本次是在既有資料線路上做補強：

- `docs/technical-learning-center.md`：既有技術觀念學習中心，保留長文教學與白話說明。
- `js/technical-registry.js`：新增為前端與測試可引用的統一 registry，承接既有技術知識、型態、策略、篩選器與評分規則。
- `jobs/strategy_center.py`：既有策略中心資料庫種子與命中計算，已補入更多策略定義，仍寫入原本的 `strategy_definitions`。
- `jobs/compute_signals.py`：既有每日技術、量價、籌碼、題材評分計算。
- `jobs/compute_patterns.py`、`jobs/pattern_detector.py`：既有型態偵測任務。
- `db/phase6_schema.sql`：既有策略、型態、主力行為、AI 檢討與每日報告資料表。

## 現有資料庫盤點

| 位置 | 用途 | 格式 | 前端引用 |
| --- | --- | --- | --- |
| `docs/technical-learning-center.md` | 技術觀念、K線、均線、量價、型態、風控教學 | Markdown | 目前為文件，未直接渲染成頁面 |
| `js/data.js` | Demo 與前端預設資料、篩選標籤 | JS 物件 | `DATA.filterTags`、預設 `DATA` |
| `js/views.js` | 個股技術判讀、支撐壓力、型態文字 | 函式與即時計算 | 個股分析頁 |
| `js/pages/stock.js` | K線、MA、MACD、KD、RSI 顯示 | 函式與 Supabase 查詢 | 個股分析頁 |
| `js/pages/screen.js` | 每日篩選頁 | 前端表格 | `DATA.screen` |
| `js/pages/patterns.js` | 型態辨識頁 | Supabase `detected_patterns` | 型態辨識 |
| `js/pages/strategy-center.js` | 策略中心頁 | Supabase `strategy_definitions/results/backtests` | 策略中心 |
| `jobs/compute_signals.py` | MA/KD/MACD/RSI、量價、籌碼、候選池 | Python job → Supabase | 每日篩選、個股分析 |
| `jobs/strategy_center.py` | 策略定義、策略命中、簡易回測 | Python list/dict → Supabase | 策略中心 |
| `jobs/compute_patterns.py` | Phase 6 型態偵測 | Python job → Supabase | 型態辨識 |
| `db/phase6_schema.sql` | 策略、型態、主力、報告資料表 | SQL | Supabase |

## 本次補強分類

已補入並去重整併：

- 技術指標：趨勢、動能、波動率、成交量。
- K線型態：單根 K 與多根 K。
- 圖表型態：反轉型態與延續型態。
- 量價關係：價漲量增、價跌量增、低檔爆量、放量突破、無量突破等。
- 支撐壓力：前高、前低、大量成交區、缺口、均線、箱型、頸線、VWAP 等。
- 台股籌碼：外資、投信、自營商、三大法人、主力、融資融券、當沖比、集保等。
- 策略模板：突破、回測、反轉、趨勢追蹤、震盪區間、風險避開。
- 股票篩選器：強勢股、放量突破、均線糾結、W底、頭肩底、MACD、RSI、籌碼轉強與風險篩選。
- AI 評分：`trendScore`、`volumeScore`、`patternScore`、`chipScore`、`riskScore`。

## 標準資料格式

`js/technical-registry.js` 的每筆資料盡量補齊以下欄位，前端仍可只讀原本需要的欄位：

```js
{
  id,
  name,
  alias,
  category,
  type,
  bias,
  description,
  logic,
  formula,
  bullishSignals,
  bearishSignals,
  neutralSignals,
  confirmSignals,
  failSignals,
  riskNotes,
  suitableMarket,
  unsuitableMarket,
  screenerConditions,
  scoreWeight,
  uiTags,
  explanationTemplate
}
```

策略與篩選器另外保留：

- 策略：`strategyType`、`entryConditions`、`exitConditions`、`stopLossRules`、`takeProfitRules`、`scoringWeights`。
- 篩選器：`requiredDataFields`、`conditions`、`optionalConditions`、`excludeConditions`、`scoreWeights`、`outputTags`。

## 去重規則

優先使用 `id`。沒有 `id` 時用 `name + category` 判斷。已建立同義詞 canonical mapping：

- `MACD`、`macd`、`平滑異同移動平均線` → `macd`
- `RSI`、`相對強弱指標` → `rsi`
- `KD`、`Stochastic`、`隨機指標` → `kd`
- `W底`、`雙底`、`Double Bottom` → `double-bottom`
- `M頭`、`雙頂`、`Double Top` → `double-top`
- `箱型`、`矩形整理`、`區間整理` → `box-consolidation`
- `布林通道`、`Bollinger Bands` → `bollinger-bands`
- `均線`、`MA`、`SMA` 依用途拆成 `sma` 與各期均線，通用別名保留在 `alias`

## 統一匯出入口

`js/technical-registry.js` 會掛到 `window`，也支援 Node `require` 測試。

可用 helper：

- `getAllTechnicalKnowledge()`
- `findTechnicalKnowledgeById(id)`
- `findTechnicalKnowledgeByCategory(category)`
- `findTechnicalKnowledgeByType(type)`
- `searchTechnicalKnowledge(keyword)`
- `getStrategiesByType(type)`
- `getScreenersByCategory(category)`
- `buildTechnicalExplanation(result)`
- `calculateTechnicalScore(input)`

## 前端如何引用

`index.html` 已在 `js/data.js` 後載入：

```html
<script src="js/technical-registry.js?v=20260526-knowledge-merge" defer></script>
```

目前已接入：

- `js/pages/screen.js`：每日篩選頁會讀取 `getScreenersByCategory()`，顯示技術資料庫中的篩選模板與條件。
- `js/pages/strategy-center.js`：策略中心會讀取 `getStrategiesByType()`，當 Supabase 策略資料尚未回填時，先顯示本機策略模板；資料回填後，仍以原本 `strategy_definitions`、`strategy_results`、`strategy_backtests` 為主。

前端頁面可直接呼叫：

```js
const macd = findTechnicalKnowledgeById('macd');
const patterns = findTechnicalKnowledgeByCategory('chart-pattern');
const hits = searchTechnicalKnowledge('箱型整理');
const score = calculateTechnicalScore({
  trendScore: 80,
  volumeScore: 75,
  patternScore: 70,
  chipScore: 65,
  riskScore: 20
});
```

## 與既有功能共用

- AI 模擬操盤：仍以 `jobs/run_ai_lab.py`、`jobs/run_ai_intraday.py` 產生交易資料；可用 registry 的策略說明與風險模板補強前端解釋。
- 每日報告：`jobs/generate_daily_report.py` 可引用策略、型態、風險分類文字，避免重複撰寫。
- 股票篩選器：`jobs/compute_signals.py` 繼續負責可執行條件；registry 提供篩選器定義、欄位需求與解釋模板。
- 策略中心：`jobs/strategy_center.py` 仍寫入 `strategy_definitions`；已先把放量突破、箱型突破、前高突破、均線糾結突破、突破後回測不破、月線回測、W底反轉、RSI底背離、高檔爆量長上影風險與既有 MACD 轉強接成可執行命中邏輯，其餘新增模板仍先作為定義資料。

## 如何新增指標、型態、策略

1. 先搜尋 `js/technical-registry.js` 是否已有同義詞或類似項。
2. 若已有，補欄位，不新增重複項。
3. 新增時使用英文小寫 dash id，例如 `macd-bullish-divergence`。
4. 必填 `category`、`type`、`description`、`logic`、`riskNotes`、`screenerConditions`。
5. 策略若需要真正跑命中結果，再同步補 `jobs/strategy_center.py::hit_strategy()`。
6. 若需要新增 Supabase 欄位，優先放入現有 `metadata` 或 JSON 欄位；不可動 API key、登入、RLS 或 service role。

## 測試方式

```powershell
node --check js/technical-registry.js
node -e "const k=require('./js/technical-registry.js'); console.log(k.searchTechnicalKnowledge('MACD').length)"
python -m py_compile jobs/strategy_center.py
python -m py_compile jobs/compute_signals.py
```

必查關鍵字：

- `MACD`
- `RSI`
- `W底`
- `箱型整理`
- `放量突破`

## 已知缺口

- `js/technical-registry.js` 目前已接入每日篩選與策略中心；尚未把所有內容做成完整前台學習頁。
- 部分新增策略仍是定義模板，尚未都有實際 `hit_strategy()` 計算邏輯；目前已可執行：放量突破、箱型突破、前高突破、均線糾結突破、突破後回測不破、月線回測、W底反轉、RSI底背離、高檔爆量長上影風險、MACD 轉強。
- 台股籌碼中的分點、大戶、董監與集保資料需要資料源穩定後才能完整自動評分。
- K線型態與圖表型態目前以偵測任務與說明資料並存，未來可把 `compute_patterns.py` 的型態名稱改為直接引用 registry id。
