const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function requireEnv() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY");
  }
}

async function getAuthUser(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: auth },
  });
  if (!r.ok) return null;
  return await r.json();
}

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await r.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!r.ok) {
    throw new Error(`Supabase ${r.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function authAdmin(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await r.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!r.ok) {
    throw new Error(`Auth ${r.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

function asText(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeAuthEmail(account: string, authEmail = "") {
  if (authEmail.includes("@")) return authEmail.toLowerCase();
  if (account.includes("@")) return account.toLowerCase();
  const safe = account.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${safe || "user"}@stocklab.local`;
}

async function getCurrentAccount(req: Request) {
  const user = await getAuthUser(req);
  if (!user?.email) return "";
  const candidates = [
    asText(user.user_metadata?.account),
    asText(user.email),
  ].filter(Boolean);
  for (const account of candidates) {
    const rows = await rest(
      `app_users?select=account&account=eq.${encodeURIComponent(account)}&limit=1`,
      { method: "GET" },
    ) as Array<{ account: string }>;
    if (rows?.[0]?.account) return rows[0].account;
  }
  return candidates[0] || "";
}

async function isAdminUser(req: Request) {
  const user = await getAuthUser(req);
  if (!user?.email) return false;
  if (user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin") return true;

  const accounts = [
    asText(user.user_metadata?.account),
    asText(user.email),
  ].filter(Boolean);
  for (const account of accounts) {
    const rows = await rest(
      `app_users?select=role&account=eq.${encodeURIComponent(account)}&limit=1`,
      { method: "GET" },
    ) as Array<{ role: string }>;
    if (rows?.[0]?.role === "admin") return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    requireEnv();
    const body = await req.json().catch(() => ({}));
    const action = asText(body.action);
    const payload = body.payload ?? {};

    if (action === "public_register") {
      const p = payload as Record<string, unknown>;
      const account = asText(p.account);
      const password = asText(p.password);
      const nick = asText(p.nick) || account;
      const authEmail = normalizeAuthEmail(account, asText(p.auth_email));
      if (!account || !password || !nick) return json({ ok: false, error: "請填寫帳號、密碼與暱稱" }, 400);
      if (password.length < 6) return json({ ok: false, error: "密碼至少需要 6 碼" }, 400);

      const existing = await rest(
        `app_users?select=account&account=eq.${encodeURIComponent(account)}&limit=1`,
        { method: "GET" },
      ) as Array<{ account: string }>;
      if (existing.length) return json({ ok: false, error: "此帳號已存在" }, 409);

      await authAdmin("admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: authEmail,
          password,
          email_confirm: true,
          user_metadata: { account, nick, role: "user" },
        }),
      });
      const data = await rest("app_users?on_conflict=account", {
        method: "POST",
        body: JSON.stringify({
          account,
          password: "",
          nick,
          role: "user",
          days_remaining: 0,
          created_at: new Date().toISOString(),
        }),
      });
      return json({ ok: true, data });
    }

    if (action === "get_watchlist") {
      const account = await getCurrentAccount(req);
      if (!account) return json({ ok: false, error: "Login required" }, 401);
      const rows = await rest(
        `app_watchlist?select=symbol,name,note,sort_order,created_at,updated_at&account=eq.${encodeURIComponent(account)}&order=sort_order.asc,updated_at.desc`,
        { method: "GET" },
      ) as Array<Record<string, unknown>>;
      return json({
        ok: true,
        data: rows.map((r) => ({
          c: asText(r.symbol),
          n: asText(r.name) || asText(r.symbol),
          note: asText(r.note),
          addedAt: asText(r.created_at),
        })),
      });
    }

    if (action === "save_watchlist") {
      const account = await getCurrentAccount(req);
      if (!account) return json({ ok: false, error: "Login required" }, 401);
      const rows = Array.isArray((payload as Record<string, unknown>).rows)
        ? (payload as Record<string, unknown>).rows as Array<Record<string, unknown>>
        : [];
      const cleaned = rows
        .map((r, i) => ({
          account,
          symbol: asText(r.c || r.symbol),
          name: asText(r.n || r.name),
          note: asText(r.note),
          sort_order: i,
          updated_at: new Date().toISOString(),
        }))
        .filter((r) => /^[1-9]\d{3}$/.test(r.symbol));

      await rest(`app_watchlist?account=eq.${encodeURIComponent(account)}`, { method: "DELETE" });
      if (!cleaned.length) return json({ ok: true, data: [] });
      const data = await rest("app_watchlist?on_conflict=account,symbol", {
        method: "POST",
        body: JSON.stringify(cleaned),
      });
      return json({ ok: true, data });
    }

    if (!(await isAdminUser(req))) {
      return json({ ok: false, error: "Admin only" }, 403);
    }

    if (action === "save_stock") {
      const p = payload as Record<string, unknown>;
      const symbol = asText(p.symbol);
      if (!symbol || !asText(p.name)) return json({ ok: false, error: "Missing symbol/name" }, 400);
      const data = await rest("stocks?on_conflict=symbol", {
        method: "POST",
        body: JSON.stringify({
          symbol,
          name: asText(p.name),
          market: asText(p.market),
          industry: asText(p.industry) || null,
          theme_tags: Array.isArray(p.theme_tags) ? p.theme_tags : [],
          is_leader: !!p.is_leader,
          is_active: true,
          updated_at: new Date().toISOString(),
        }),
      });
      return json({ ok: true, data });
    }

    if (action === "create_user") {
      const p = payload as Record<string, unknown>;
      const account = asText(p.account);
      const password = asText(p.password);
      const nick = asText(p.nick) || account;
      const role = asText(p.role) || "user";
      const days = Number(p.days_remaining) || 0;
      const authEmail = normalizeAuthEmail(account, asText(p.auth_email));
      if (!account || !password) return json({ ok: false, error: "Missing account/password" }, 400);
      await authAdmin("admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: authEmail,
          password,
          email_confirm: true,
          user_metadata: { account, nick, role },
        }),
      });
      const data = await rest("app_users?on_conflict=account", {
        method: "POST",
        body: JSON.stringify({
          account,
          password: "",
          nick,
          role,
          days_remaining: days,
          created_at: new Date().toISOString(),
        }),
      });
      return json({ ok: true, data });
    }

    if (action === "delete_user") {
      const p = payload as Record<string, unknown>;
      const account = asText(p.account);
      if (!account) return json({ ok: false, error: "Missing account" }, 400);
      const authEmail = normalizeAuthEmail(account, asText(p.auth_email));
      const found = await authAdmin(`admin/users?email=${encodeURIComponent(authEmail)}`, {
        method: "GET",
      }) as { users?: Array<{ id: string; email?: string }> };
      const user = found.users?.find((u) => u.email === authEmail);
      if (user?.id) await authAdmin(`admin/users/${user.id}`, { method: "DELETE" });
      await rest(`app_user_entitlements?account=eq.${encodeURIComponent(account)}`, { method: "DELETE" });
      await rest(`app_watchlist?account=eq.${encodeURIComponent(account)}`, { method: "DELETE" });
      await rest(`app_users?account=eq.${encodeURIComponent(account)}`, { method: "DELETE" });
      return json({ ok: true });
    }

    if (action === "save_theme") {
      const p = payload as Record<string, unknown>;
      const id = p.id ? Number(p.id) : null;
      const row = {
        ...(id ? { id } : {}),
        theme_name: asText(p.theme_name),
        description: asText(p.description),
        heat_score: Number(p.heat_score) || 0,
        trend_status: asText(p.trend_status) || "觀察",
        updated_at: new Date().toISOString(),
      };
      if (!row.theme_name) return json({ ok: false, error: "Missing theme_name" }, 400);
      const data = await rest(id ? `themes?id=eq.${id}` : "themes", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(row),
      });
      return json({ ok: true, data });
    }

    if (action === "save_theme_stocks") {
      const rows = Array.isArray(payload) ? payload : [];
      const cleaned = rows
        .map((r: Record<string, unknown>) => ({
          theme_id: Number(r.theme_id),
          symbol: asText(r.symbol),
          role: asText(r.role) || "成分",
          supply_chain_level: asText(r.supply_chain_level),
          relevance_score: Number(r.relevance_score) || 80,
          note: asText(r.note),
        }))
        .filter((r) => r.theme_id && r.symbol);
      if (!cleaned.length) return json({ ok: false, error: "No theme stocks" }, 400);
      const data = await rest("theme_stocks?on_conflict=theme_id,symbol", {
        method: "POST",
        body: JSON.stringify(cleaned),
      });
      return json({ ok: true, data });
    }

    if (action === "save_entitlements") {
      const p = payload as Record<string, unknown>;
      const account = asText(p.account);
      const rows = Array.isArray(p.rows) ? p.rows : [];
      if (!account) return json({ ok: false, error: "Missing account" }, 400);
      const cleaned = rows.map((r: Record<string, unknown>) => ({
        account,
        page_id: asText(r.id),
        name: asText(r.name),
        enabled: !!r.enabled,
        days: Number(r.days) || 0,
        updated_at: new Date().toISOString(),
      })).filter((r) => r.page_id);
      const data = await rest("app_user_entitlements?on_conflict=account,page_id", {
        method: "POST",
        body: JSON.stringify(cleaned),
      });
      return json({ ok: true, data });
    }

    if (action === "save_activation_settings") {
      const rows = Array.isArray(payload) ? payload : [];
      const cleaned = rows.map((r: Record<string, unknown>) => ({
        page_id: asText(r.id),
        name: asText(r.name),
        enabled: !!r.enabled,
        days: Number(r.days) || 0,
        updated_at: new Date().toISOString(),
      })).filter((r) => r.page_id);
      const data = await rest("app_activation_settings?on_conflict=page_id", {
        method: "POST",
        body: JSON.stringify(cleaned),
      });
      return json({ ok: true, data });
    }

    if (action === "save_page_maintenance") {
      const rows = Array.isArray(payload) ? payload : [];
      const cleaned = rows.map((r: Record<string, unknown>) => ({
        page_id: asText(r.id),
        name: asText(r.name),
        maintenance: !!r.maintenance,
        message: asText(r.message),
        updated_at: new Date().toISOString(),
      })).filter((r) => r.page_id);
      const data = await rest("app_page_maintenance?on_conflict=page_id", {
        method: "POST",
        body: JSON.stringify(cleaned),
      });
      return json({ ok: true, data });
    }

    if (action === "save_report_note") {
      const note = asText((payload as Record<string, unknown>).note);
      const data = await rest("app_settings?on_conflict=key", {
        method: "POST",
        body: JSON.stringify({
          key: "daily_report_note",
          value: note,
          updated_at: new Date().toISOString(),
        }),
      });
      return json({ ok: true, data });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e?.message ?? e) }, 500);
  }
});
