# AI 自動營運公司模組

此資料夾是獨立板塊，不和原本股票功能檔案混在一起。之後要改 AI 自動營運公司，優先修改這裡：

- `index.js`：模組入口，提供 `vAICompany()` 與 `bindAICompanyPage()`。
- `agents/agentDefinitions.js`：AI 員工能力與禁止動作預留。
- `core/companyRuntime.js`：未來接排程、AI API、Supabase 的核心流程預留。
- `components/dashboard.js`：畫面元件與資料轉換。
- `mock/mockCompanyData.js`：公司角色、任務紀錄、審核與會議的預設資料。
- `types/schema.js`：未來轉 TypeScript / Supabase schema 時可沿用的資料型別。
- `styles.css`：此板塊專用樣式。

目前版本會優先讀取現有網站的 `DATA` 物件：

- `DATA.market`：加權、櫃買、漲跌家數。
- `DATA.screen`：股票篩選候選清單。
- `DATA.agents`：現有 AI 量化機器人狀態。

若資料尚未載入，才使用本資料夾內的預設流程資料維持畫面完整。
