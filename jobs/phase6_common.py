from __future__ import annotations

import json
import math
from collections import defaultdict
from statistics import mean, pstdev

from sb_common import log, mark_status, sb_select


def nf(value, default=None):
    if value is None or value == "":
        return default
    try:
        if isinstance(value, str):
            value = value.replace(",", "").replace("%", "").strip()
        out = float(value)
        if math.isnan(out) or math.isinf(out):
            return default
        return out
    except Exception:
        return default


def ni(value, default=0):
    n = nf(value, None)
    return default if n is None else int(round(n))


def to_json(value):
    return json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value


def avg(values):
    clean = [x for x in values if x is not None]
    return mean(clean) if clean else None


def ma(values, length):
    if len(values) < length:
        return None
    return avg(values[-length:])


def wma(values, length):
    if len(values) < length:
        return None
    window = values[-length:]
    weight_sum = length * (length + 1) / 2
    return sum(v * (i + 1) for i, v in enumerate(window)) / weight_sum


def hma(values, length=9):
    half = max(2, int(length / 2))
    root = max(2, int(math.sqrt(length)))
    if len(values) < length + root:
        return None
    synthetic = []
    for end in range(length, len(values) + 1):
        sub = values[:end]
        fast = wma(sub, half)
        slow = wma(sub, length)
        if fast is not None and slow is not None:
            synthetic.append(2 * fast - slow)
    return wma(synthetic, root)


def stdev(values, length=9):
    if len(values) < length:
        return None
    return pstdev(values[-length:])


def ema_series(values, length):
    if not values:
        return []
    k = 2 / (length + 1)
    out = []
    prev = values[0]
    for value in values:
        prev = value * k + prev * (1 - k)
        out.append(prev)
    return out


def macd(values):
    if len(values) < 35:
        return None, None, None
    e12 = ema_series(values, 12)
    e26 = ema_series(values, 26)
    dif = [a - b for a, b in zip(e12, e26)]
    dea = ema_series(dif, 9)
    hist = [a - b for a, b in zip(dif, dea)]
    return dif[-1], dea[-1], hist[-1]


def rsi(values, length=14):
    if len(values) <= length:
        return None
    gains, losses = [], []
    for i in range(1, len(values)):
        diff = values[i] - values[i - 1]
        gains.append(max(diff, 0))
        losses.append(abs(min(diff, 0)))
    ag = avg(gains[-length:]) or 0
    al = avg(losses[-length:]) or 0
    if al == 0:
        return 100
    rs = ag / al
    return 100 - (100 / (1 + rs))


def latest_trade_date():
    rows = sb_select("daily_prices", "select=date&order=date.desc", page_size=1, max_rows=1)
    return rows[0]["date"] if rows else None


def load_stock_map():
    out = {}
    for row in sb_select("stocks", "select=symbol,name,market,industry,theme", page_size=1000, max_rows=5000):
        out[str(row.get("symbol"))] = row
    return out


def load_price_series(max_rows=260000):
    fields = "date,symbol,open,high,low,close,change,change_percent,volume,amount"
    rows = sb_select("daily_prices", f"select={fields}&order=symbol.asc,date.asc", page_size=1000, max_rows=max_rows)
    grouped = defaultdict(list)
    for row in rows:
        symbol = str(row.get("symbol") or "").strip()
        if not symbol:
            continue
        normalized = {
            "date": row.get("date"),
            "symbol": symbol,
            "open": nf(row.get("open")),
            "high": nf(row.get("high")),
            "low": nf(row.get("low")),
            "close": nf(row.get("close")),
            "change": nf(row.get("change")),
            "change_percent": nf(row.get("change_percent")),
            "volume": nf(row.get("volume"), 0),
            "amount": nf(row.get("amount"), 0),
        }
        if normalized["close"] is not None:
            grouped[symbol].append(normalized)
    return dict(grouped)


def series_values(rows, key):
    return [nf(r.get(key)) for r in rows if nf(r.get(key)) is not None]


def volume_lots(row):
    volume = nf(row.get("volume"), 0)
    if volume > 100000:
        return volume / 1000
    return volume


def pct(a, b):
    a = nf(a)
    b = nf(b)
    if a is None or b in (None, 0):
        return None
    return (a - b) / b * 100


def stock_name(stock_map, symbol):
    row = stock_map.get(str(symbol), {})
    return row.get("name") or str(symbol)


def safe_status(key, ok=True, note=""):
    try:
        mark_status(key, ok, note)
    except Exception as exc:
        log(f"data_status 略過: {exc}")
