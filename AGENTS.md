# Codex 專案規則

本專案是台股盤後題材操盤系統與 AI 量化模擬操盤實驗室。Codex 修改時必須延續既有架構，不可重寫整站或破壞既有資料流程。

## 專案架構

- `index.html` 是前端入口，只負責載入既有 CSS 與 JavaScript。
- `js/pages/` 放各板塊頁面，每個新增板塊優先建立獨立檔案。
- `js/data-center/` 放資料中心模組，負責整理即時、盤後、產業類股與時段模式。
- `js/api.js`、`js/data.js`、`js/views.js`、`js/router.js` 是前端共用基礎。
- `jobs/` 放 Python 資料處理、策略計算與 AI 模擬操盤。
- `.github/workflows/daily.yml` 是每日資料管線。
- `db/` 放 Supabase schema 與階段升級 SQL。

## 前端修改規則

- 不重寫 `index.html`，只在需要接入新檔案時加入 script。
- 新頁面放在 `js/pages/`，命名使用小寫與連字號，例如 `strategy-center.js`。
- 新頁面必須提供空狀態與 fallback，資料讀不到不可讓整頁壞掉。
- 不在前端放任何 service_role、OpenAI key、Gemini key、FinMind token。
- 文字使用繁體中文。
- 導覽與 router 依既有集中管理方式加入，不硬寫重複邏輯。

## Python Jobs 修改規則

- 每個 job 必須可以從 `jobs/` 目錄用命令列單獨執行。
- 密鑰只從環境變數讀取，例如 `SUPABASE_URL`、`SUPABASE_SERVICE_KEY`。
- 單一資料源失敗時要記錄錯誤並盡量產出可用結果，不可讓整條資料管線停止。
- 共用資料讀取、指標計算、Supabase 寫入輔助優先放在獨立 helper 檔案。
- 輸出到 Supabase 的資料欄位要固定，同批 upsert 不可混用不同 key。

## Supabase 安全規則

- 前端只使用 anon key 讀取允許公開的資料。
- 新增 table 必須啟用 RLS。
- 前端資料表只開放 `select` policy。
- 寫入、更新、刪除由 service_role job 執行，不在前端開放。
- 新階段 schema 以 `db/phase6_schema.sql` 追加，不覆蓋既有 schema。

## GitHub Actions 規則

- 保留既有 `fetch_all`、`compute_signals`、`run_ai_lab` 等流程。
- 新增步驟放在原本流程後方。
- 非關鍵分析步驟使用 `if: always()`，避免單一 job 失敗導致後續不執行。
- Secrets 只從 GitHub Secrets 注入。

## 不可破壞既有功能

- 不刪除既有 `js/pages`、`js/data-center`、`jobs` 檔案。
- 不改變既有資料表語意。
- 不移除現有帳號、開通、維修、資料狀態、AI 模擬操盤功能。
- 如需替換畫面，應保留 fallback 或相容資料讀取方式。

## 新增功能命名規則

- 前端頁面：`js/pages/<feature-name>.js`
- Python job：`jobs/<feature_name>.py`
- 共用 Python helper：`jobs/<domain>_common.py`
- SQL：`db/phase<version>_schema.sql`
- 文件：根目錄使用大寫階段名，例如 `PHASE6.md`
