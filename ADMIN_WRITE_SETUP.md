# 後台寫入安全化：admin-write Edge Function

這一步把後台寫入從瀏覽器移到 Supabase Edge Function。

## 1. Supabase Secrets

到 Supabase：

`Project Settings` → `Edge Functions` → `Secrets`

確認有這三個：

```text
SUPABASE_URL=https://wgyumblfupaspzywiwzc.supabase.co
SUPABASE_ANON_KEY=你的 anon key
SUPABASE_SERVICE_ROLE_KEY=你的 service_role key
```

注意：`SUPABASE_SERVICE_ROLE_KEY` 只能放在 Supabase Secrets，不能放進 `index.html`。

## 2. 建立 admin-write Function

到：

`Edge Functions` → `Deploy a new function` → `Via Editor`

Function 名稱：

```text
admin-write
```

把這個檔案內容貼到 Supabase 的 `index.ts`：

```text
supabase/functions/admin-write/index.ts
```

按 Deploy。

## 3. 建立真正管理員帳號

到 Supabase：

`Authentication` → `Users` → `Add user`

建立你的管理員 Email / Password。

然後到 SQL Editor 跑：

```sql
insert into app_users(account, password, nick, role, days_remaining)
values ('你的管理員 email', '', '系統管理員', 'admin', 9999)
on conflict (account) do update
set role = 'admin',
    nick = excluded.nick,
    days_remaining = 9999;
```

目前 `admin-write` 會用登入者的 Supabase Auth email 去 `app_users.account` 檢查 `role='admin'`。

## 4. 下一步要改前端

接下來要把 `index.html` 的後台按鈕改成呼叫：

```text
https://wgyumblfupaspzywiwzc.supabase.co/functions/v1/admin-write
```

而不是直接呼叫 Supabase REST API。

前端呼叫時必須帶 Supabase Auth JWT：

```http
Authorization: Bearer 使用者登入後的 access_token
```

所以後續要把目前 `app_users` 登入改成 Supabase Auth 登入。
