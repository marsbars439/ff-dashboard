#!/usr/bin/env python3
"""
Simple FantasyPros Rest of Season Rankings Scraper
Extracts: Player, Team, Position, Proj. Fpts
"""

import argparse
import json
import re
import time
from datetime import datetime

import pandas as pd
import requests
from bs4 import BeautifulSoup


class FantasyProsScraper:
    """Simple scraper for FantasyPros Rest of Season Rankings"""

    def __init__(self, debug: bool = True):
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        self.debug = debug

    # ------------------------------------------------------------------
    def debug_print(self, message: str) -> None:
        """Print debug messages if debug mode is enabled"""
        if self.debug:
            print(f"DEBUG: {message}")

    # ------------------------------------------------------------------
    def extract_player_data(self, html_content: str, position: str):
        """Extract player data focusing only on the 4 required fields"""
        soup = BeautifulSoup(html_content, "html.parser")
        players_data = []

        scripts = soup.find_all("script")
        for script in scripts:
            script_text = str(script.string) if script.string else str(script)
            if not script_text or len(script_text.strip()) < 100:
                continue

            patterns_to_check = [
                r"var\s+ecrData\s*=\s*({.*?});",
                r"var\s+data\s*=\s*({.*?});",
                r"var\s+playerData\s*=\s*({.*?});",
                r"var\s+rankingsData\s*=\s*({.*?});",
                r"window\.ecrData\s*=\s*({.*?});",
                r"const\s+\w+\s*=\s*({.*?\"players\".*?});",
            ]

            for pattern in patterns_to_check:
                matches = re.finditer(pattern, script_text, re.DOTALL)
                for match in matches:
                    try:
                        json_str = match.group(1)
                        data = json.loads(json_str)
                        if isinstance(data, dict) and "players" in data:
                            players = data["players"]
                            self.debug_print(f"Found {len(players)} players in JSON data")
                            if players and isinstance(players[0], dict):
                                sample_keys = list(players[0].keys())
                                self.debug_print(f"Available fields: {sample_keys}")

                            for player in players:
                                if not isinstance(player, dict):
                                    continue
                                player_name = player.get("player_name", "").strip()
                                team_id = player.get("player_team_id", "").strip()
                                proj_fpts = player.get("r2p_pts", "").strip()
                                if player_name and proj_fpts:
                                    players_data.append(
                                        {
                                            "Player": player_name,
                                            "Team": team_id,
                                            "Position": position,
                                            "Proj. Fpts": proj_fpts,
                                        }
                                    )

                            if players_data:
                                self.debug_print(
                                    f"Successfully extracted {len(players_data)} players"
                                )
                                return players_data
                    except json.JSONDecodeError as e:
                        self.debug_print(f"JSON decode error: {e}")
                        continue

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
                df = df[df["Player"].str.strip() != ""]
                df = df[df["Proj. Fpts"].str.strip() != ""]
                df = df.drop_duplicates(subset=["Player"], keep="first")
                if self.debug:
                    print(f"✅ Successfully scraped {len(df)} {position} players")
                    print("\nSample data:")
                    print(df.head().to_string(index=False))
                return df
            else:
                if self.debug:
                    print(f"❌ No data found for {position}")
                return pd.DataFrame()
        except Exception as e:
            if self.debug:
                print(f"❌ Error fetching {position}: {str(e)}")
            return pd.DataFrame()

    # ------------------------------------------------------------------
    def scrape_all_rankings(self) -> pd.DataFrame:
        """Scrape all position rankings"""
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

    if df.empty:
        if args.json:
            print(json.dumps({"players": [], "failed": []}))
        else:
            print("\n❌ Failed to scrape any data")
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
        payload = {"players": records, "failed": []}
        print(json.dumps(payload))

    return df, filename


if __name__ == "__main__":
    main()

