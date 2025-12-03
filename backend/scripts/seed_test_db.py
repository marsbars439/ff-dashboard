import sqlite3
import os
import random
import datetime
from faker import Faker

def create_tables(cursor):
    """Create all necessary tables."""
    print("Creating tables...")
    
    cursor.execute('PRAGMA foreign_keys = ON')

    # Managers Table
    cursor.execute("""
      CREATE TABLE IF NOT EXISTS managers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_id TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        sleeper_username TEXT,
        sleeper_user_id TEXT,
        email TEXT,
        passcode TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    """)

    # League Settings Table
    cursor.execute("""
      CREATE TABLE IF NOT EXISTS league_settings (
        year INTEGER PRIMARY KEY,
        league_id TEXT
      )
    """)

    # Team Seasons Table
    cursor.execute("""
      CREATE TABLE IF NOT EXISTS team_seasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        name_id TEXT NOT NULL,
        team_name TEXT,
        wins INTEGER,
        losses INTEGER,
        points_for REAL,
        points_against REAL,
        regular_season_rank INTEGER,
        playoff_finish INTEGER,
        dues REAL,
        payout REAL,
        dues_chumpion REAL DEFAULT 0,
        high_game REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, name_id),
        FOREIGN KEY (name_id) REFERENCES managers(name_id)
      )
    """)
    
    # ROS Rankings Table
    cursor.execute("""
      CREATE TABLE IF NOT EXISTS ros_rankings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT NOT NULL,
        team TEXT,
        position TEXT,
        proj_pts REAL,
        sos_season INTEGER,
        sos_playoffs INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    """)

    print("Tables created successfully.")

def populate_data(cursor, fake):
    """Populate tables with fake data."""
    print("Populating data...")

    # 1. Create Managers
    managers = []
    for _ in range(12):
        full_name = fake.name()
        name_id = full_name.lower().replace(' ', '')
        managers.append((name_id, full_name, fake.user_name(), str(fake.random_number(digits=18, fix_len=True)), fake.email()))
    
    cursor.executemany("""
        INSERT INTO managers (name_id, full_name, sleeper_username, sleeper_user_id, email)
        VALUES (?, ?, ?, ?, ?)
    """, managers)
    print(f"Inserted {len(managers)} managers.")

    # 2. Create League Settings for past and current years
    current_year = datetime.datetime.now().year
    years = [current_year - 2, current_year - 1, current_year]
    for year in years:
        cursor.execute("INSERT INTO league_settings (year, league_id) VALUES (?, ?)",
                       (year, str(fake.random_number(digits=10, fix_len=True))))
    print(f"Inserted league settings for years: {years}")

    # 3. Create Team Seasons
    team_seasons = []
    for year in years:
        for name_id, _, _, _, _ in managers:
            if year < current_year: # Past season with full data
                wins = random.randint(2, 12)
                losses = 14 - wins
                rank = random.randint(1, 12)
                playoff_finish = random.choice([1, 2, 3, 4, 5, 6, None, None, None]) if rank <= 6 else None
                team_seasons.append((
                    year, name_id, f"{fake.word().capitalize()} {fake.word().capitalize()}",
                    wins, losses, round(random.uniform(1500, 2200), 2), round(random.uniform(1500, 2200), 2),
                    rank, playoff_finish
                ))
            else: # Current season, in progress
                team_seasons.append((
                    year, name_id, f"{fake.word().capitalize()} {fake.word().capitalize()}",
                    0, 0, 0, 0, None, None
                ))
    
    cursor.executemany("""
        INSERT INTO team_seasons (year, name_id, team_name, wins, losses, points_for, points_against, regular_season_rank, playoff_finish)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, team_seasons)
    print(f"Inserted {len(team_seasons)} team seasons.")
    
    # 4. Populate ROS Rankings
    ros_players = []
    positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
    for _ in range(300):
        ros_players.append((
            fake.name(),
            fake.company_suffix().upper(), # Using this for fake team names
            random.choice(positions),
            round(random.uniform(50, 250), 1),
            random.randint(1, 32),  # sos_season (strength of schedule rank)
            random.randint(1, 32)   # sos_playoffs
        ))

    cursor.executemany("""
        INSERT INTO ros_rankings (player_name, team, position, proj_pts, sos_season, sos_playoffs)
        VALUES (?, ?, ?, ?, ?, ?)
    """, ros_players)
    print(f"Inserted {len(ros_players)} ROS player rankings.")

def main():
    """Main function to seed the test database."""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(project_root, 'data', 'fantasy_football.db')

    # Delete the old database file if it exists
    if os.path.exists(db_path):
        print(f"Deleting existing database at {db_path}")
        os.remove(db_path)
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        create_tables(cursor)
        populate_data(cursor, Faker())
        
        conn.commit()
        print("\nDatabase seeded successfully!")

    except sqlite3.Error as e:
        print(f"Database error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    main()
