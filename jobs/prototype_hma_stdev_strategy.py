#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Prototype for AI #1: HMA(9) + Standard Deviation(9) daily strategy.

This is a feasibility tester, not the production AI runner yet. It proves that
the requested rules can be computed from daily OHLC data:
  - HMA length 9
  - STDEV length 9
  - key bar: close crosses above HMA and close > HMA
  - entry: next bar open, fallback to next close if open missing
  - SL: entry - key bar STDEV * 2
  - trailing TP: entry + current bar STDEV * 3, updated on each new bar
  - Friday close exit
  - after stop loss: require a new cross above HMA plus breakout over previous 6 bars high
"""
import math
import os
from collections import defaultdict


HMA_LENGTH = 9
STDEV_LENGTH = 9
SL_MULT = 2
TP_MULT = 3


def log(msg):
    print(msg, flush=True)


def wma(values, length):
    out = [None] * len(values)
    if length < 1:
        return out
    denom = length * (length + 1) / 2
    for i in range(length - 1, len(values)):
        window = values[i - length + 1 : i + 1]
        if any(v is None for v in window):
            continue
        out[i] = sum(v * (j + 1) for j, v in enumerate(window)) / denom
    return out


def hma(values, length=HMA_LENGTH):
    half = max(1, int(length / 2))
    root = max(1, int(math.sqrt(length)))
    w_half = wma(values, half)
    w_full = wma(values, length)
    diff = [
        (2 * a - b) if a is not None and b is not None else None
        for a, b in zip(w_half, w_full)
    ]
    return wma(diff, root)


def stdev(values, length=STDEV_LENGTH):
    out = [None] * len(values)
    for i in range(length - 1, len(values)):
        window = values[i - length + 1 : i + 1]
        if any(v is None for v in window):
            continue
        mean = sum(window) / length
        out[i] = math.sqrt(sum((v - mean) ** 2 for v in window) / length)
    return out


def weekday(date_text):
    import datetime as dt

    return dt.date.fromisoformat(str(date_text)[:10]).weekday()


def price(row, key, fallback=None):
    value = row.get(key)
    if value is None:
        value = row.get(fallback) if fallback else None
    try:
        return float(value)
    except Exception:
        return None


def backtest_hma_stdev(rows):
    rows = sorted(rows, key=lambda r: r["date"])
    rows = [r for r in rows if price(r, "close") is not None]
    closes = [price(r, "close") for r in rows]
    highs = [price(r, "high", "close") for r in rows]
    lows = [price(r, "low", "close") for r in rows]
    h = hma(closes)
    sd = stdev(closes)

    trades = []
    in_pos = False
    pending_entry = None
    entry = sl = tp = None
    entry_date = None
    stopped_out = False

    for i, row in enumerate(rows):
        close = closes[i]
        hi = highs[i]
        lo = lows[i]
        cur_hma = h[i]
        cur_sd = sd[i]
        prev_close = closes[i - 1] if i > 0 else None
        prev_hma = h[i - 1] if i > 0 else None

        if pending_entry is not None and not in_pos:
            key_i = pending_entry
            key_sd = sd[key_i]
            entry_px = price(row, "open", "close")
            if entry_px is not None and key_sd is not None:
                entry = entry_px
                sl = entry - key_sd * SL_MULT
                tp = entry + key_sd * TP_MULT
                entry_date = row["date"]
                in_pos = True
            pending_entry = None

        if in_pos:
            if cur_sd is not None:
                tp = max(tp, entry + cur_sd * TP_MULT)
            exit_reason = None
            exit_px = None
            if lo is not None and lo <= sl:
                exit_reason = "停損"
                exit_px = sl
                stopped_out = True
            elif hi is not None and hi >= tp:
                exit_reason = "移動停利"
                exit_px = tp
            elif weekday(row["date"]) == 4:
                exit_reason = "週五出場"
                exit_px = close
            if exit_reason:
                trades.append(
                    {
                        "entry_date": entry_date,
                        "exit_date": row["date"],
                        "entry": round(entry, 2),
                        "exit": round(exit_px, 2),
                        "return_pct": round((exit_px - entry) / entry * 100, 2),
                        "reason": exit_reason,
                    }
                )
                in_pos = False
                entry = sl = tp = entry_date = None
            continue

        if i + 1 >= len(rows):
            continue
        crossed = (
            prev_close is not None
            and prev_hma is not None
            and cur_hma is not None
            and prev_close <= prev_hma
            and close > cur_hma
        )
        if not crossed:
            continue
        if stopped_out:
            if i < 6:
                continue
            prev6_high = max(v for v in highs[i - 6 : i] if v is not None)
            if close <= prev6_high:
                continue
        pending_entry = i

    wins = [t for t in trades if t["return_pct"] > 0]
    total = len(trades)
    avg = sum(t["return_pct"] for t in trades) / total if total else 0
    return {
        "bars": len(rows),
        "signals": total,
        "win_rate": round(len(wins) / total * 100, 2) if total else 0,
        "avg_return": round(avg, 2),
        "trades": trades[-10:],
    }


def synthetic_rows():
    rows = []
    import datetime as dt

    d = dt.date(2026, 1, 1)
    px = 50.0
    for i in range(90):
        while d.weekday() >= 5:
            d += dt.timedelta(days=1)
        drift = math.sin(i / 5) * 0.9 + (0.35 if i % 17 > 8 else -0.15)
        open_px = px
        close = max(5, px + drift)
        high = max(open_px, close) + 0.8
        low = min(open_px, close) - 0.8
        rows.append({"date": d.isoformat(), "open": open_px, "high": high, "low": low, "close": close})
        px = close
        d += dt.timedelta(days=1)
    return rows


def main():
    symbol = os.environ.get("TEST_SYMBOL", "").strip()
    if symbol:
        from sb_common import sb_select

        rows = sb_select(
            "daily_prices",
            f"select=date,open,high,low,close&symbol=eq.{symbol}&order=date.asc",
            page_size=1000,
        )
        log(f"loaded {len(rows)} real bars for {symbol}")
    else:
        rows = synthetic_rows()
        log("SUPABASE not required: using synthetic bars")
    result = backtest_hma_stdev(rows)
    log(f"bars={result['bars']} trades={result['signals']} win_rate={result['win_rate']} avg={result['avg_return']}")
    for t in result["trades"]:
        log(str(t))


if __name__ == "__main__":
    main()
