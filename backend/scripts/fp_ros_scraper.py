#!/usr/bin/env python3
"""
Simple FantasyPros Rest of Season Rankings Scraper
Extracts: Player, Team, Position, Proj. Fpts
"""

import argparse
import json
import time
from datetime import datetime

import pandas as pd
import requests
from bs4 import BeautifulSoup

try:
    import brotli  # type: ignore  # noqa: F401

    _HAS_BROTLI = True
except ImportError:  # pragma: no cover - optional dependency hint
    _HAS_BROTLI = False


class FantasyProsScraper:
    """Simple scraper for FantasyPros Rest of Season Rankings"""

    def __init__(self, debug: bool = True):
        self.debug = debug
        self.failures: list[str] = []

        encoding_values = ["gzip", "deflate"]
        if _HAS_BROTLI:
            encoding_values.append("br")

        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": ", ".join(encoding_values),
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)

        if not _HAS_BROTLI:
            self.debug_print(
                "Brotli module not available; requesting gzip/deflate responses"
            )

    # ------------------------------------------------------------------
    def debug_print(self, message: str) -> None:
        """Print debug messages if debug mode is enabled"""
        if self.debug:
            print(f"DEBUG: {message}")

    # ------------------------------------------------------------------
    def record_failure(self, position: str, reason: str) -> None:
        """Record a scraping failure for later reporting"""
        message = f"{position}: {reason}"
        self.failures.append(message)
        if self.debug:
            print(f"❌ {message}")

    # ------------------------------------------------------------------
    def extract_player_data(self, html_content: str, position: str):
        """Extract player data focusing only on the 4 required fields"""

        def _normalize_string(value: str | None) -> str:
            if value is None:
                return ""
            if isinstance(value, (int, float)):
                return str(value)
            return value.strip()

        def _to_float(value) -> float | None:
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str):
                cleaned = value.replace(",", "").strip()
                if not cleaned:
                    return None
                try:
                    return float(cleaned)
                except ValueError:
                    return None
            return None

        def _json_candidates(script_tag) -> list[str]:
            text = script_tag.string or script_tag.text or ""
            text = text.strip()
            if not text:
                return []

            candidates: list[str] = []

            if script_tag.get("type") == "application/json":
                candidates.append(text)
                return candidates

            prefixes = [
                "window.__NUXT__",
                "window.ecrData",
                "window.ecrDataProps",
                "var ecrData",
                "var data",
                "var playerData",
                "var rankingsData",
                "const ecrData",
                "const data",
            ]

            for prefix in prefixes:
                if prefix in text:
                    _, candidate = text.split(prefix, 1)
                    candidate = candidate.split("=", 1)[-1].strip()
                    if candidate.endswith(";"):
                        candidate = candidate[:-1]
                    brace_index = min(
                        [
                            idx
                            for idx in [candidate.find("{"), candidate.find("[")]
                            if idx != -1
                        ]
                        or [-1]
                    )
                    if brace_index > 0:
                        candidate = candidate[brace_index:]
                    if candidate:
                        candidates.append(candidate)

            if not candidates and "{" in text and "}" in text:
                first = text.find("{")
                last = text.rfind("}")
                if first != -1 and last != -1 and last > first:
                    candidates.append(text[first : last + 1])

            return candidates

        def _looks_like_player_entry(entry: dict) -> bool:
            if not isinstance(entry, dict):
                return False

            name_tokens = ["player", "name", "team_name", "display_name"]
            projection_tokens = ["pts", "points", "proj", "fpts"]

            def _has_token(data, tokens: list[str]) -> bool:
                stack: list[object] = [data]
                while stack:
                    current = stack.pop()
                    if isinstance(current, dict):
                        for key, value in current.items():
                            if isinstance(key, str):
                                lowered = key.lower()
                                if any(token in lowered for token in tokens):
                                    return True
                            if isinstance(value, (dict, list)):
                                stack.append(value)
                    elif isinstance(current, list):
                        for item in current:
                            if isinstance(item, (dict, list)):
                                stack.append(item)
                return False

            has_name_like = _has_token(entry, name_tokens)
            has_projection_like = _has_token(entry, projection_tokens)

            return has_name_like and has_projection_like

        def _find_player_lists(data):
            player_lists: list[list[dict]] = []
            seen: set[int] = set()
            stack = [data]
            while stack:
                current = stack.pop()
                if isinstance(current, dict):
                    for value in current.values():
                        if isinstance(value, (dict, list)):
                            stack.append(value)
                elif isinstance(current, list):
                    if id(current) not in seen:
                        seen.add(id(current))
                        dict_items = [item for item in current if isinstance(item, dict)]
                        if dict_items and any(
                            _looks_like_player_entry(item) for item in dict_items
                        ):
                            player_lists.append(current)
                    for item in current:
                        if isinstance(item, (dict, list)):
                            stack.append(item)
            return player_lists

        def _extract_from_players(players: list[dict]):
            extracted = []

            if players and isinstance(players[0], dict):
                self.debug_print(f"Found {len(players)} raw player entries")
                sample_keys = list(players[0].keys())
                self.debug_print(f"Available fields: {sample_keys}")

            proj_candidates = [
                "r2p_pts",
                "ros_pts",
                "ros_points",
                "proj_pts",
                "proj_fpts",
                "pts",
                "pts_half",
                "points",
                "points_total",
                "fantasy_points",
                "fantasy_points_total",
                "fpts",
            ]

            team_keys = [
                "player_team_id",
                "team",
                "team_name",
                "short_name",
                "player_team",
                "nfl_team_id",
            ]

            name_keys = [
                "player_name",
                "name",
                "player",
                "display_name",
            ]
            if position == "DST":
                name_keys.append("team_name")

            def _resolve_candidate(value, validator, seen: set[int] | None = None):
                if seen is None:
                    seen = set()

                if isinstance(value, (dict, list)):
                    obj_id = id(value)
                    if obj_id in seen:
                        return None
                    seen.add(obj_id)

                direct = validator(value)
                if direct is not None:
                    return direct

                if isinstance(value, dict):
                    prioritized_keys = ["value", "raw"]
                    for key in prioritized_keys:
                        if key in value:
                            result = _resolve_candidate(value[key], validator, seen)
                            if result is not None:
                                return result
                    for key, child in value.items():
                        if key in prioritized_keys:
                            continue
                        result = _resolve_candidate(child, validator, seen)
                        if result is not None:
                            return result
                elif isinstance(value, list):
                    for item in value:
                        result = _resolve_candidate(item, validator, seen)
                        if result is not None:
                            return result

                return None

            def _search_nested_value(data, tokens: list[str], validator):
                stack: list[object] = [data]
                while stack:
                    current = stack.pop()
                    if isinstance(current, dict):
                        for key, value in current.items():
                            if isinstance(key, str):
                                lowered = key.lower()
                                if any(token in lowered for token in tokens):
                                    candidate = _resolve_candidate(value, validator)
                                    if candidate is not None:
                                        return candidate
                            if isinstance(value, (dict, list)):
                                stack.append(value)
                    elif isinstance(current, list):
                        for item in current:
                            if isinstance(item, (dict, list)):
                                stack.append(item)
                return None

            def _get_string_value(data: dict, keys: list[str]) -> str:
                # Try direct keys first for backward compatibility
                for key in keys:
                    value = data.get(key)
                    if isinstance(value, str) and value.strip():
                        return value.strip()

                result = _search_nested_value(
                    data,
                    keys,
                    lambda value: (
                        value.strip()
                        if isinstance(value, str) and value.strip()
                        else None
                    ),
                )
                return result or ""

            def _get_projection_value(data: dict, keys: list[str]) -> float | None:
                for key in keys:
                    if key in data:
                        proj_value = _resolve_candidate(data.get(key), _to_float)
                        if proj_value is not None:
                            return proj_value

                return _search_nested_value(data, keys, _to_float)

            for player in players:
                if not isinstance(player, dict):
                    continue

                player_name_raw = _get_string_value(player, name_keys)
                player_name = (
                    _normalize_string(player_name_raw) if player_name_raw else ""
                )
                if not player_name:
                    continue

                team_value_raw = _get_string_value(player, team_keys)
                team_value = _normalize_string(team_value_raw) if team_value_raw else ""
                if position == "DST" and not team_value:
                    team_value = player_name

                proj_value = _get_projection_value(player, proj_candidates)

                if proj_value is None:
                    proj_value = _search_nested_value(
                        player,
                        ["pts", "points", "proj", "fpts"],
                        _to_float,
                    )

                if proj_value is None:
                    continue

                extracted.append(
                    {
                        "Player": player_name,
                        "Team": team_value,
                        "Position": position,
                        "Proj. Fpts": proj_value,
                    }
                )

            if extracted:
                self.debug_print(
                    f"Successfully extracted {len(extracted)} players"
                )

            return extracted

        soup = BeautifulSoup(html_content, "html.parser")

        scripts = soup.find_all("script")
        best_extracted: list[dict] = []

        for script in scripts:
            candidates = _json_candidates(script)
            for candidate in candidates:
                cleaned_candidate = candidate.strip().rstrip(";")
                while cleaned_candidate and cleaned_candidate[-1] not in ("}", "]"):
                    cleaned_candidate = cleaned_candidate[:-1].rstrip()
                if not cleaned_candidate:
                    continue
                try:
                    json_data = json.loads(cleaned_candidate)
                except json.JSONDecodeError as exc:
                    self.debug_print(f"JSON decode error: {exc}")
                    continue

                for players in _find_player_lists(json_data):
                    extracted = _extract_from_players(players)
                    if extracted and len(extracted) > len(best_extracted):
                        best_extracted = extracted

        if best_extracted:
            return best_extracted

        self.debug_print("No player data found in JSON")
        return []

    # ------------------------------------------------------------------
    def scrape_rankings(self, url: str, position: str) -> pd.DataFrame:
        """Scrape rankings from a single URL"""
        if self.debug:
            print("\n" + "=" * 50)
            print(f"Fetching {position} rankings...")
            print("=" * 50)

        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            players_data = self.extract_player_data(response.text, position)
            if players_data:
                df = pd.DataFrame(players_data)
                df["Player"] = df["Player"].astype(str).str.strip()
                df = df[df["Player"] != ""]
                df["Team"] = df["Team"].fillna("").astype(str).str.strip()
                df["Proj. Fpts"] = pd.to_numeric(
                    df["Proj. Fpts"], errors="coerce"
                )
                df = df.dropna(subset=["Proj. Fpts"])
                df = df.drop_duplicates(subset=["Player"], keep="first")
                if self.debug:
                    print(f"✅ Successfully scraped {len(df)} {position} players")
                    print("\nSample data:")
                    print(df.head().to_string(index=False))
                return df
            else:
                self.record_failure(position, "No player data found")
                return pd.DataFrame()
        except Exception as e:
            self.record_failure(position, str(e))
            return pd.DataFrame()

    # ------------------------------------------------------------------
    def scrape_all_rankings(self) -> pd.DataFrame:
        """Scrape all position rankings"""
        self.failures = []
        urls_config = [
            {"url": "https://www.fantasypros.com/nfl/rankings/ros-qb.php", "position": "QB"},
            {"url": "https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-rb.php", "position": "RB"},
            {"url": "https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-wr.php", "position": "WR"},
            {"url": "https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-te.php", "position": "TE"},
            {"url": "https://www.fantasypros.com/nfl/rankings/ros-dst.php", "position": "DST"},
        ]

        all_data = []

        for config in urls_config:
            df = self.scrape_rankings(config["url"], config["position"])
            if not df.empty:
                all_data.append(df)
            if self.debug:
                print("Waiting 2 seconds...")
            time.sleep(2)

        if all_data:
            combined_df = pd.concat(all_data, ignore_index=True)
            combined_df = combined_df.drop_duplicates(subset=["Player"], keep="first")
            combined_df["Proj. Fpts"] = pd.to_numeric(
                combined_df["Proj. Fpts"], errors="coerce"
            )
            combined_df = combined_df.sort_values(
                ["Position", "Proj. Fpts"], ascending=[True, False]
            )
            return combined_df
        return pd.DataFrame()

    # ------------------------------------------------------------------
    def save_to_csv(self, df: pd.DataFrame, filename: str | None = None) -> str | None:
        """Save DataFrame to CSV file"""
        if df.empty:
            if self.debug:
                print("\n❌ No data to save")
            return None

        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"fantasypros_rankings_{timestamp}.csv"

        df.to_csv(filename, index=False)

        if self.debug:
            print("\n" + "=" * 60)
            print("✅ SCRAPING COMPLETE!")
            print("=" * 60)
            print(f"📄 File saved: {filename}")
            print(f"👥 Total players: {len(df)}")
            print("\n📊 Breakdown by position:")
            pos_counts = df["Position"].value_counts()
            for pos, count in pos_counts.items():
                print(f"   {pos}: {count} players")
            print("\n📈 Projected Points Range:")
            print(f"   Highest: {df['Proj. Fpts'].max():.1f}")
            print(f"   Lowest: {df['Proj. Fpts'].min():.1f}")
            print(f"   Average: {df['Proj. Fpts'].mean():.1f}")
            print("=" * 60)

        return filename


def main() -> tuple[pd.DataFrame | None, str | None]:
    """Main function to run the scraper"""
    parser = argparse.ArgumentParser(
        description="Simple FantasyPros Rankings Scraper"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output data as JSON to stdout (suppresses other output)",
    )
    args = parser.parse_args()

    scraper = FantasyProsScraper(debug=not args.json)
    df = scraper.scrape_all_rankings()

    failures = scraper.failures

    if df.empty:
        if args.json:
            print(json.dumps({"players": [], "failed": failures}))
        else:
            print("\n❌ Failed to scrape any data")
            if failures:
                print("Reasons:")
                for failure in failures:
                    print(f"   - {failure}")
        return None, None

    filename = None
    if not args.json:
        filename = scraper.save_to_csv(df)
        print("\n📋 Final data sample (top 10 by projected points):")
        top_players = df.nlargest(10, "Proj. Fpts")
        print(top_players.to_string(index=False))
        print(
            f"\n🎉 Success! '{filename}' is ready for your database!"
        )
    else:
        records = df.rename(
            columns={
                "Player": "player_name",
                "Team": "team",
                "Position": "position",
                "Proj. Fpts": "proj_pts",
            }
        ).to_dict(orient="records")
        payload = {"players": records, "failed": failures}
        print(json.dumps(payload))

    if not args.json and failures:
        print("\n⚠️ Issues encountered during scraping:")
        for failure in failures:
            print(f"   - {failure}")

    return df, filename


if __name__ == "__main__":
    main()

