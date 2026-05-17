# stock-lab 第三階段 安裝與啟用說明

完成後：每天盤後 GitHub Actions 自動抓 TWSE/TPEX/MOPS 全部資料寫進 Supabase，
網頁讀 Supabase 顯示真實數據（連不上時自動退回範例畫面，不會壞）。全程 0 元。

---

## 檔案總覽

| 檔案 | 放哪 | 用途 |
|---|---|---|
| `index.html` | repo 根目錄 | 網站（已接 Supabase anon 唯讀） |
| `db/schema.sql` | repo `db/` | 18 張表 + RLS + 3 個 AI 機器人種子 |
| `jobs/fetch_all.py` | repo `jobs/` | 盤後抓取主程式 |
| `requirements.txt` | repo 根目錄 | Python 套件 |
| `.github/workflows/daily.yml` | repo `.github/workflows/` | 每日排程 |

---

## 步驟 1：建資料表（一次性，約 1 分鐘）

1. 進 Supabase 專案 → 左側 **SQL Editor** → **New query**
2. 打開 `db/schema.sql`，全選貼上 → 按 **Run**
3. 看到 Success 即可。左側 **Table Editor** 應出現 19 張表，
   且 `ai_agents` 已有 3 筆機器人。

> 可重複執行，不會壞既有資料。

---

## 步驟 2：上傳全部檔案到 `stock-lab` repo

把這個資料夾內所有檔案，**保持相同資料夾結構**上傳到 GitHub
（用網頁 Add file → Upload files，可整包拖拉；資料夾結構會自動建立）。

上傳後 repo 應長這樣：

```
stock-lab/
├─ index.html
├─ requirements.txt
├─ db/schema.sql
├─ jobs/fetch_all.py
└─ .github/workflows/daily.yml
```

---

## 步驟 3：設定 GitHub Secrets（放 service_role，安全）

repo → **Settings** → 左側 **Secrets and variables** → **Actions**
→ **New repository secret**，新增兩個：

| Name（一定要完全一樣） | Value |
|---|---|
| `SUPABASE_URL` | `https://wgyumblfupaspzywiwzc.supabase.co` |
| `SUPABASE_SERVICE_KEY` | 你的 service_role key（建議用「重置後的新 key」，見最下方安全提醒） |

> service_role 只放這裡。它不會出現在 index.html、不會被 commit。

---

## 步驟 4：手動觸發第一次測試

1. repo → 上方 **Actions** 分頁
2. 左側點 **每日盤後抓取** → 右側 **Run workflow** → 綠色 **Run workflow**
3. 等 2～5 分鐘，點進那次執行看 log：
   - 每個來源會印 `✅ 完成（N 筆）` 或 `❌ 失敗：原因`
   - 部分來源失敗不影響其他（例如非交易日當天行情會是 0 筆，正常）
4. 回 Supabase **Table Editor** 看 `daily_prices` 等表是否有資料進來

> 第一次跑若某來源失敗，把該來源的錯誤訊息貼給我，我針對那個端點微調。
> （官方端點偶爾改格式，腳本已留好錯誤訊息方便定位。）

---

## 步驟 5：確認網頁顯示真實資料

開 `https://qazx5313.github.io/stock-lab/`
（或你的 Pages 網址；記得 Pages 的 Source 要指到這個 repo 的 `main /root`）

- 連得上且當天有資料 → 首頁漲跌家數、精選股會變成真實數字
- 非交易日或資料庫還沒資料 → 自動顯示範例畫面（這是正常後備行為）

---

## 排程時間

平日（一～五）自動跑兩次：

| 台灣時間 | 用途 |
|---|---|
| 14:30 | 盤後初抓（行情） |
| 16:15 | 盤後正式抓（法人/資券較完整） |

非交易日（假日、休市）官方無資料，腳本會記錄 0 筆並標記，不會出錯。

---

## ⚠️ 安全提醒（重要，務必做）

你先前在對話中貼過 service_role key。請在一切設定好、測試成功後：

1. Supabase → **Settings** → **API** → **service_role** 旁按 **Reset / Roll**
2. 產生新的 key
3. 回 GitHub Secrets 把 `SUPABASE_SERVICE_KEY` 的值換成新的
4. 舊 key 即失效，外洩也無妨

anon key 放在 index.html 是設計上正常的（公開唯讀，且已設 RLS 只能 select），
不需更換。

---

## 之後（第四、五階段，待你確認再做）

- 第四階段：用已進來的 daily_prices 算 MA/KD/MACD/RSI、量增、法人連買、
  題材熱度評分 → 寫 daily_signals / candidate_pool（個股分析週月線、每日篩選會真的能用）
- 第五階段：3 個 AI 機器人回測 → 通過門檻才呼叫 FinMind → 模擬交易 → 檢討 → 策略升版
- 後台「編輯/儲存」按鈕：第四階段接寫入 API 後就能用

有任何來源報錯，把 Actions log 該段貼給我即可。
