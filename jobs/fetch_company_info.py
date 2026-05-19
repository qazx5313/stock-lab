#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Legacy company-info job.

This job intentionally does not call FinMind. FinMind is reserved for the AI
quant lab only. Daily stock names and markets are maintained by fetch_all.py
from TWSE/TPEx official after-hours endpoints.
"""
from sb_common import log, mark_status


def main():
    log("=== fetch_company_info skipped ===")
    msg = "skipped: company names/markets are maintained by official TWSE/TPEx daily data; FinMind reserved for AI lab"
    mark_status("fetch_company_info", True, msg)
    log("  " + msg)


if __name__ == "__main__":
    main()
