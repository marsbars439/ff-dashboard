from pathlib import Path
import unittest

from backend.scripts.fp_ros_scraper import FantasyProsScraper


FIXTURES = Path(__file__).parent / "fixtures"


class FantasyProsScraperTest(unittest.TestCase):
    def setUp(self):
        self.scraper = FantasyProsScraper(debug=False)

    def _load_fixture(self, name: str) -> str:
        return (FIXTURES / name).read_text()

    def test_extract_wr_players_from_nested_list(self):
        html = self._load_fixture("ros_wr_fixture.html")
        players = self.scraper.extract_player_data(html, "WR")
        self.assertEqual(2, len(players))

        self.assertEqual(
            {
                "Player": "Justin Jefferson",
                "Team": "MIN",
                "Position": "WR",
                "Proj. Fpts": 230.5,
            },
            players[0],
        )

        self.assertEqual(players[1]["Player"], "CeeDee Lamb")
        self.assertEqual(players[1]["Team"], "DAL")
        self.assertEqual(players[1]["Position"], "WR")
        self.assertAlmostEqual(players[1]["Proj. Fpts"], 220.0)

    def test_extract_dst_entries_uses_team_name_when_missing_team(self):
        html = self._load_fixture("ros_dst_fixture.html")
        players = self.scraper.extract_player_data(html, "DST")
        self.assertEqual(2, len(players))

        first = players[0]
        self.assertEqual(first["Player"], "San Francisco 49ers")
        self.assertEqual(first["Team"], "San Francisco 49ers")
        self.assertEqual(first["Position"], "DST")
        self.assertAlmostEqual(first["Proj. Fpts"], 123.4)

        second = players[1]
        self.assertEqual(second["Player"], "Buffalo Bills")
        self.assertEqual(second["Team"], "Buffalo Bills")
        self.assertAlmostEqual(second["Proj. Fpts"], 110.1)


if __name__ == "__main__":
    unittest.main()
