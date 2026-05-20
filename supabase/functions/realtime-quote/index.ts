const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const MIS_BOOT = "https://mis.twse.com.tw/stock/index?lang=zhHant";
const MIS_API = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";
const MIS_CHARTS: Record<string, string> = {
  TWSE_CHART: "https://mis.twse.com.tw/stock/data/mis_ohlc_TSE.txt",
  TPEX_CHART: "https://mis.twse.com.tw/stock/data/mis_ohlc_OTC.txt",
};
const TAIFEX_REGULAR = "https://mis.taifex.com.tw/futures/RegularSession/EquityIndices/FuturesDomestic/";
const TAIFEX_AFTER_HOURS = "https://mis.taifex.com.tw/futures/AfterHoursSession/EquityIndices/FuturesDomestic/";
const TAIFEX_SEARCH = "https://mis.taifex.com.tw/futures/api/getSearchResult";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function toNumber(v: unknown) {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function toInt(v: unknown) {
  const n = toNumber(v);
  return n == null ? null : Math.round(n);
}

function parseDate(v: unknown) {
  const s = String(v ?? "").replace(/[^\d]/g, "");
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return null;
}

function parseTime(v: unknown) {
  const s = String(v ?? "").trim();
  if (/^\d{6}$/.test(s)) return `${s.slice(0, 2)}:${s.slice(2, 4)}:${s.slice(4)}`;
  return s || null;
}

function tokenFor(symbol: string, market = "") {
  const m = market.toUpperCase();
  if (m === "TPEX" || m === "OTC") return [`otc_${symbol}.tw`];
  if (m === "TWSE" || m === "TSE") return [`tse_${symbol}.tw`];
  return [`tse_${symbol}.tw`, `otc_${symbol}.tw`];
}

function quoteRow(q: Record<string, unknown>) {
  const sym = String(q.c ?? "").trim();
  const price = toNumber(q.z);
  const date = parseDate(q.d);
  if (!sym || price == null || !date) return null;
  const prev = toNumber(q.y);
  const change = prev == null ? null : Number((price - prev).toFixed(2));
  const changePercent = prev ? Number(((price - prev) / prev * 100).toFixed(2)) : null;
  const ex = String(q.ex ?? "").toLowerCase();
  let market = ex.includes("otc") ? "TPEX" : "TWSE";
  if (sym === "t00") market = "TWSE_INDEX";
  if (sym === "o00") market = "TPEX_INDEX";
  return {
    symbol: sym === "t00" ? "T00" : sym === "o00" ? "O00" : sym,
    name: String(q.n ?? q.nf ?? sym),
    market,
    quote_date: date,
    quote_time: String(q.t ?? q["%"] ?? "").trim() || null,
    open: toNumber(q.o),
    high: toNumber(q.h),
    low: toNumber(q.l),
    price,
    prev_close: prev,
    change,
    change_percent: changePercent,
    volume: toInt(q.v),
    amount: null,
    source: "TWSE_MIS_EDGE",
    updated_at: new Date().toISOString(),
  };
}

async function bootstrapCookie() {
  try {
    const r = await fetch(MIS_BOOT, { headers: { "User-Agent": "Mozilla/5.0" } });
    return r.headers.get("set-cookie") ?? "";
  } catch {
    return "";
  }
}

async function fetchMis(tokens: string[], cookie: string) {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < tokens.length; i += 45) {
    const part = tokens.slice(i, i + 45);
    const u = new URL(MIS_API);
    u.searchParams.set("ex_ch", part.join("|"));
    u.searchParams.set("json", "1");
    u.searchParams.set("delay", "0");
    u.searchParams.set("_", String(Date.now()));
    const r = await fetch(u, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: MIS_BOOT,
        Cookie: cookie,
      },
    });
    if (!r.ok) continue;
    const data = await r.json().catch(() => ({}));
    if (Array.isArray(data.msgArray)) out.push(...data.msgArray);
  }
  return out;
}

async function fetchCharts(cookie: string) {
  const rows: Record<string, unknown>[] = [];
  for (const [market, url] of Object.entries(MIS_CHARTS)) {
    try {
      const u = new URL(url);
      u.searchParams.set("_", String(Date.now()));
      const r = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0", Referer: MIS_BOOT, Cookie: cookie },
      });
      if (!r.ok) continue;
      const data = await r.json();
      const points = (Array.isArray(data.ohlcArray) ? data.ohlcArray : [])
        .map((p: Record<string, unknown>) => {
          const price = toNumber(p.c);
          const amount = toNumber(p.s);
          const t = String(p.t ?? "");
          if (price == null || !t) return null;
          return { t, p: price, a: amount == null ? null : Number((amount / 100).toFixed(2)) };
        })
        .filter(Boolean);
      if (!points.length) continue;
      const staticObj = data.staticObj ?? {};
      const qdate = parseDate(String(staticObj.key ?? "").split("_").pop()) ??
        new Date().toISOString().slice(0, 10);
      const last = points[points.length - 1] as Record<string, unknown>;
      rows.push({
        symbol: market === "TWSE_CHART" ? "T00_CHART" : "O00_CHART",
        name: market === "TWSE_CHART" ? "TWSE intraday chart" : "TPEX intraday chart",
        market,
        quote_date: qdate,
        quote_time: String(last.t ?? "").replace(/^(\d{2})(\d{2})(\d{2}).*/, "$1:$2:$3"),
        open: (points[0] as Record<string, unknown>).p,
        high: Math.max(...points.map((p) => Number((p as Record<string, unknown>).p))),
        low: Math.min(...points.map((p) => Number((p as Record<string, unknown>).p))),
        price: last.p,
        prev_close: null,
        change: null,
        change_percent: null,
        volume: toInt(staticObj.tv),
        amount: toInt(staticObj.tz),
        source: JSON.stringify({ points: points.slice(-260), static: staticObj }),
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Keep the quote endpoint useful even when one chart file is unavailable.
    }
  }
  return rows;
}

function isTaifexDaySession() {
  const now = new Date();
  const tw = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const hm = tw.getHours() * 100 + tw.getMinutes();
  return hm >= 845 && hm <= 1345;
}

async function searchTaifexTxF(referer: string) {
  await fetch(referer, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
  const r = await fetch(TAIFEX_SEARCH, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: referer,
      Origin: "https://mis.taifex.com.tw",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ KeyWord: "臺指期" }),
  });
  if (!r.ok) return [];
  const data = await r.json().catch(() => ({}));
  return Array.isArray(data.RtData) ? data.RtData : [];
}

function taifexRow(symbol: string, values: Record<string, unknown>) {
  const price = toNumber(values["125"]) ?? toNumber(values["257"]);
  const ref = toNumber(values["129"]);
  const date = parseDate(values["144"]) ?? new Date().toISOString().slice(0, 10);
  if (price == null) return null;
  const change = ref == null ? null : Number((price - ref).toFixed(2));
  const changePercent = ref ? Number(((price - ref) / ref * 100).toFixed(2)) : null;
  return {
    symbol: "TXF",
    name: `台指期 ${symbol}`,
    market: "TAIFEX",
    quote_date: date,
    quote_time: parseTime(values["143"] ?? values["880"]),
    open: toNumber(values["126"]),
    high: toNumber(values["130"]),
    low: toNumber(values["131"]),
    price,
    prev_close: ref,
    change,
    change_percent: changePercent,
    volume: toInt(values["404"]) ?? toInt(values["258"]),
    amount: null,
    source: symbol.endsWith("-M") ? "TAIFEX_EDGE_RT_NIGHT" : "TAIFEX_EDGE_RT_DAY",
    updated_at: new Date().toISOString(),
  };
}

async function fetchTaifexTxf() {
  const plan = [
    { level: "0", suffix: "-F", referer: TAIFEX_REGULAR },
    { level: "1", suffix: "-M", referer: TAIFEX_AFTER_HOURS },
  ];
  if (!isTaifexDaySession()) plan.reverse();
  for (const p of plan) {
    try {
      const rows = await searchTaifexTxF(p.referer);
      const symbols = rows
        .filter((r: Record<string, unknown>) =>
          r.Level1ID === p.level &&
          r.KindID === "1" &&
          r.SymbolType === "F" &&
          r.CID === "TXF" &&
          String(r.SymbolID ?? "").endsWith(p.suffix)
        )
        .map((r: Record<string, unknown>) => String(r.SymbolID))
        .filter((s: string) => s && s !== "TXF-S" && s !== "TXF-P")
        .slice(0, 8);
      if (!symbols.length) continue;
      const sid = Math.random().toString(36).slice(2, 10);
      const ws = new WebSocket(`wss://mis.taifex.com.tw/futures/rt/000/${sid}/websocket`);
      const messages = await new Promise<unknown[]>((resolve) => {
        const out: unknown[] = [];
        let subscribed = false;
        const subscribe = () => {
          if (subscribed || ws.readyState !== WebSocket.OPEN) return;
          subscribed = true;
          ws.send(JSON.stringify([JSON.stringify({ type: "subscribe", symbols })]));
        };
        const done = () => { try { ws.close(); } catch (_) { /* noop */ } resolve(out); };
        const timer = setTimeout(done, 5500);
        ws.onopen = () => setTimeout(subscribe, 1200);
        ws.onmessage = (ev) => {
          const raw = String(ev.data ?? "");
          if (raw === "o") {
            subscribe();
            return;
          }
          if (!raw || raw === "h") return;
          if (!raw.startsWith("a")) return;
          try {
            for (const item of JSON.parse(raw.slice(1))) {
              const msg = JSON.parse(item);
              out.push(msg);
            }
          } catch (_) {
            // Ignore malformed websocket frames.
          }
          if (out.length >= symbols.length) {
            clearTimeout(timer);
            done();
          }
        };
        ws.onerror = () => { clearTimeout(timer); done(); };
      });
      const bySymbol = new Map<string, Record<string, unknown>>();
      for (const msg of messages as Array<Record<string, unknown>>) {
        if (msg.type !== "quote") continue;
        const q = msg.quote as Record<string, unknown> | undefined;
        const symbol = String(q?.symbol ?? "");
        const values = q?.values as Record<string, unknown> | undefined;
        if (symbol && values) bySymbol.set(symbol, { ...(bySymbol.get(symbol) ?? {}), ...values });
      }
      let best = null as ReturnType<typeof taifexRow> | null;
      for (const [symbol, values] of bySymbol.entries()) {
        const row = taifexRow(symbol, values);
        if (!row) continue;
        if (!best || Number(row.volume ?? 0) > Number(best.volume ?? 0)) best = row;
      }
      if (best) return best;
    } catch {
      // Try next TAIFEX session.
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const q = new URL(req.url).searchParams;
    const requested = Array.isArray(body.symbols)
      ? body.symbols
      : String(q.get("symbols") ?? "").split(",").filter(Boolean).map((symbol) => ({ symbol }));
    const tokenSet = new Set<string>(["tse_t00.tw", "otc_o00.tw"]);
    for (const item of requested) {
      const symbol = String(item?.symbol ?? item ?? "").trim();
      if (!/^[1-9]\d{3}$/.test(symbol)) continue;
      for (const token of tokenFor(symbol, String(item?.market ?? ""))) tokenSet.add(token);
    }
    const cookie = await bootstrapCookie();
    const quotes = await fetchMis([...tokenSet], cookie);
    const rows = quotes.map(quoteRow).filter(Boolean);
    rows.push(...await fetchCharts(cookie));
    const txf = await fetchTaifexTxf();
    if (txf) rows.push(txf);
    return json({
      ok: true,
      rows,
      count: rows.length,
      sourceTime: new Date().toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
