#!/usr/bin/env python3
"""Scrape FantasyPros rest-of-season rankings and compile into CSV."""
import re
import time
import csv
import sys
import argparse
import json
from urllib.parse import urljoin
import requests
import pandas as pd
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FP-ROS-Scraper/1.0; +https://example.com)"
}

PAGES = {
    "QB":  "https://www.fantasypros.com/nfl/rankings/ros-qb.php",
    "RB":  "https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-rb.php",
    "WR":  "https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-wr.php",
    "TE":  "https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-te.php",
    "DST": "https://www.fantasypros.com/nfl/rankings/ros-dst.php",
}

CANDIDATES = {
    "player": ["Player", "Name"],
    "team": ["Team", "Tm", "NFL Team", "NFLTeam"],
    "pos": ["Pos", "Position"],
    "proj": ["Proj. FPTS", "Proj. Fpts", "Projected FPTS", "Projected Pts", "Proj Pts"],
    "sos_season": ["SOS Season", "SOS (Season)"],
    "sos_playoffs": ["SOS Playoffs", "SOS (Playoffs)"],
}

def find_column(df: pd.DataFrame, names):
    lower_map = {c.lower(): c for c in df.columns}
    for n in names:
        if n.lower() in lower_map:
            return lower_map[n.lower()]
    for c in df.columns:
        if any(n.lower() in c.lower() for n in names):
            return c
    return None

def extract_csv_link(page_url: str) -> str:
    r = requests.get(page_url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for a in soup.find_all("a", href=True):
        text = (a.get_text() or "").strip().lower()
        href = a["href"].lower()
        if "csv" in text or "csv" in href or "export" in href:
            return urljoin(page_url, a["href"])
    for suffix in ["?export=csv", "?export=xls", "?csv=1", "?print=true"]:
        try_url = page_url + suffix
        rr = requests.get(try_url, headers=HEADERS, timeout=30, allow_redirects=True)
        if rr.ok and ("text/csv" in rr.headers.get("Content-Type", "").lower() or
                      rr.text.lower().startswith(("rank", "player", "name"))):
            return try_url
    raise RuntimeError(f"Could not find CSV link on {page_url}")

def normalize_frame(df: pd.DataFrame, forced_pos: str = None) -> pd.DataFrame:
    col_player = find_column(df, CANDIDATES["player"])
    col_team = find_column(df, CANDIDATES["team"])
    col_pos = find_column(df, CANDIDATES["pos"])
    col_proj = find_column(df, CANDIDATES["proj"])
    col_sos_season = find_column(df, CANDIDATES["sos_season"])
    col_sos_playoffs = find_column(df, CANDIDATES["sos_playoffs"])

    if not col_team or not col_pos:
        pat = re.compile(r"\((?P<team>[A-Z]{2,3})\s*-\s*(?P<pos>[A-Z/]{2,4})\)")
        def parse_tp(s):
            if not isinstance(s, str):
                return (None, None)
            m = pat.search(s)
            if m:
                return (m.group("team"), m.group("pos"))
            return (None, None)
        teams, poss = [], []
        base_col = col_player or df.columns[0]
        for v in df[base_col].astype(str).tolist():
            t, p = parse_tp(v)
            teams.append(t)
            poss.append(p)
        if not col_team:
            df["__team_fallback"] = teams
            col_team = "__team_fallback"
        if not col_pos:
            df["__pos_fallback"] = poss
            col_pos = "__pos_fallback"

    if forced_pos:
        df["__forced_pos"] = forced_pos
        col_pos = "__forced_pos"

    out = pd.DataFrame({
        "Player": df[col_player] if col_player else df.iloc[:, 0],
        "Team": df[col_team] if col_team else None,
        "Pos": df[col_pos] if col_pos else forced_pos,
        "Proj. Fpts": pd.to_numeric(df[col_proj], errors="coerce") if col_proj else None,
        "SOS Season": df[col_sos_season] if col_sos_season else None,
        "SOS Playoffs": df[col_sos_playoffs] if col_sos_playoffs else None,
    })

    out["Player"] = out["Player"].astype(str).str.replace(r"\s*\([^\)]+\)\s*$", "", regex=True).str.strip()
    out["Team"] = out["Team"].replace({"N/A": None, "": None})
    if forced_pos == "DST":
        out["Pos"] = "DST"
    return out

def fetch_position(pos_name: str, url: str) -> pd.DataFrame:
    csv_link = extract_csv_link(url)
    resp = requests.get(csv_link, headers=HEADERS, timeout=60)
    resp.raise_for_status()
    text = resp.content.decode("utf-8", errors="replace")
    from io import StringIO
    df_raw = pd.read_csv(StringIO(text))
    forced = "DST" if pos_name == "DST" else None
    df_norm = normalize_frame(df_raw, forced_pos=forced)
    df_norm.insert(0, "SrcPos", pos_name)
    return df_norm, df_raw, csv_link

def main():
    ap = argparse.ArgumentParser(description="Scrape FantasyPros ROS CSVs and combine.")
    ap.add_argument("--out", help="Output combined CSV path")
    ap.add_argument("--perdir", help="Directory to save per-position CSVs")
    ap.add_argument("--sleep", type=float, default=2.0, help="Seconds between requests (politeness)")
    ap.add_argument("--json", action="store_true", help="Output data as JSON to stdout")
    args = ap.parse_args()

    combined = []
    failed = []
    for pos, url in PAGES.items():
        try:
            df_norm, df_raw, csv_link = fetch_position(pos, url)
            combined.append(df_norm)
            if args.perdir:
                per_path = f"{args.perdir}/fantasypros_ros_{pos.lower()}.csv"
                df_norm.to_csv(per_path, index=False, quoting=csv.QUOTE_MINIMAL)
            if not args.json:
                print(f"[OK] {pos}: {len(df_norm)} rows  | CSV: {csv_link}")
                print(df_norm.head(3).to_string(index=False))
        except Exception as e:
            print(f"[ERR] {pos}: {e}", file=sys.stderr)
            failed.append(pos)
        time.sleep(args.sleep)

    if not combined:
        print("[FATAL] No data gathered.", file=sys.stderr)
        sys.exit(2)

    df_all = pd.concat(combined, ignore_index=True)
    cols = ["Player", "Team", "Pos", "Proj. Fpts", "SOS Season", "SOS Playoffs"]
    df_all = df_all[["SrcPos"] + cols]
    if args.out:
        df_all.to_csv(args.out, index=False, quoting=csv.QUOTE_MINIMAL)

    if args.json:
        records = df_all[cols].rename(columns={
            "Player": "player_name",
            "Team": "team",
            "Pos": "position",
            "Proj. Fpts": "proj_pts",
            "SOS Season": "sos_season",
            "SOS Playoffs": "sos_playoffs",
        }).to_dict(orient="records")
        print(json.dumps({"players": records, "failed": failed}))
    else:
        if args.out:
            print(f"\n[DONE] Wrote combined CSV: {args.out}  ({len(df_all)} total rows)")
        else:
            print(f"\n[DONE] Fetched {len(df_all)} total rows")
        print("\nColumn summary:\n", df_all[cols].dtypes)
        print("\nNull counts:\n", df_all[cols].isna().sum())

if __name__ == "__main__":
    main()
