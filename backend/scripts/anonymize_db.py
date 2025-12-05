import sqlite3
import shutil
from faker import Faker
import os
import datetime

def ensure_current_year_data(conn, cursor, fake):
    """
    Ensures that data exists for the current year to make E2E tests pass.
    It copies the most recent year's league settings and team seasons.
    """
    current_year = datetime.datetime.now().year
    print(f"--- Ensuring data exists for current year ({current_year}) ---")

    # Check if data for the current year already exists
    cursor.execute("SELECT COUNT(*) FROM league_settings WHERE year = ?", (current_year,))
    if cursor.fetchone()[0] > 0:
        print(f"Data for year {current_year} already exists. Skipping data generation.")
        return

    # 1. Create league_settings for the current year
    print(f"Creating league_settings for {current_year}...")
    cursor.execute("SELECT MAX(year) FROM league_settings")
    last_year_row = cursor.fetchone()
    if not last_year_row or not last_year_row[0]:
        print("No previous league_settings found to copy from. Skipping.")
        return
    last_year = last_year_row[0]

    new_league_id = str(fake.random_number(digits=10, fix_len=True))
    
    try:
        cursor.execute("INSERT INTO league_settings (year, league_id, sync_status) VALUES (?, ?, ?)", 
                       (current_year, new_league_id, 'pending'))
        print(f"Created league_settings for {current_year} with league_id {new_league_id}")
    except sqlite3.IntegrityError:
        print(f"league_settings for year {current_year} already exist.")


    # 2. Copy team_seasons from the most recent year
    print(f"Copying team_seasons for {current_year}...")
    cursor.execute("SELECT MAX(year) FROM team_seasons")
    last_season_year_row = cursor.fetchone()
    if not last_season_year_row or not last_season_year_row[0]:
        print("No previous team_seasons found to copy from. Skipping.")
        return
    last_season_year = last_season_year_row[0]
        
    cursor.execute("SELECT * FROM team_seasons WHERE year = ?", (last_season_year,))
    column_names = [description[0] for description in cursor.description]
    last_year_seasons = cursor.fetchall()

    for season_row in last_year_seasons:
        season_dict = dict(zip(column_names, season_row))
        
        # Reset season-specific stats for the new year
        season_dict['year'] = current_year
        season_dict['wins'] = 0
        season_dict['losses'] = 0
        season_dict['points_for'] = 0
        season_dict['points_against'] = 0
        season_dict['regular_season_rank'] = None
        season_dict['playoff_finish'] = None
        season_dict['payout'] = 0
        season_dict['high_game'] = 0
        
        insert_columns = [col for col in column_names if col != 'id']
        placeholders = ', '.join(['?' for _ in insert_columns])
        insert_values = [season_dict.get(col) for col in insert_columns]
        
        cursor.execute(f"INSERT INTO team_seasons ({', '.join(insert_columns)}) VALUES ({placeholders})", insert_values)

    print(f"Copied {len(last_year_seasons)} team seasons from {last_season_year} to {current_year}.")


def anonymize_db(db_path):
    """
    Anonymizes a fantasy football database in-place by replacing PII with fake data.
    """
    fake = Faker()
    conn = None
    
    try:
        print(f"Connecting to the database at {db_path}...")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        print("Database connection successful.")

        # --- Anonymize 'managers' table ---
        print("Anonymizing 'managers' table...")
        cursor.execute("SELECT id, name_id FROM managers")
        managers = cursor.fetchall()
        
        name_id_map = {}
        used_new_name_ids = set()

        for manager_id, old_name_id in managers:
            new_name_id = fake.user_name()
            while new_name_id in used_new_name_ids:
                new_name_id = fake.user_name()
            used_new_name_ids.add(new_name_id)

            name_id_map[old_name_id] = new_name_id

            new_full_name = fake.name()
            new_sleeper_username = fake.user_name()
            new_sleeper_user_id = str(fake.random_number(digits=18, fix_len=True))
            new_email = fake.email()
            
            cursor.execute("""
                UPDATE managers
                SET name_id = ?, full_name = ?, sleeper_username = ?,
                    sleeper_user_id = ?, email = ?, passcode = NULL
                WHERE id = ?
            """, (new_name_id, new_full_name, new_sleeper_username, 
                  new_sleeper_user_id, new_email, manager_id))

        print("'managers' table anonymized.")

        # --- Update 'team_seasons' with new name_ids ---
        print("Updating 'name_id' in 'team_seasons' table...")
        for old_name_id, new_name_id in name_id_map.items():
            cursor.execute("UPDATE team_seasons SET name_id = ? WHERE name_id = ?", (new_name_id, old_name_id))
        print("'team_seasons' name_ids updated.")

        # --- Anonymize 'team_seasons' team names ---
        print("Anonymizing 'team_seasons' team names...")
        cursor.execute("SELECT id FROM team_seasons")
        team_season_ids = cursor.fetchall()

        for (season_id,) in team_season_ids:
            new_team_name = f"{fake.word().capitalize()} {fake.word().capitalize()}"
            cursor.execute("UPDATE team_seasons SET team_name = ? WHERE id = ?", (new_team_name, season_id))
        
        print("'team_seasons' team names anonymized.")

        # --- Anonymize 'league_settings' table ---
        print("Anonymizing 'league_settings' table...")
        try:
            cursor.execute("SELECT id FROM league_settings")
            setting_ids = cursor.fetchall()
            for (setting_id,) in setting_ids:
                new_league_id = str(fake.random_number(digits=10, fix_len=True))
                cursor.execute("UPDATE league_settings SET league_id = ? WHERE id = ?", (new_league_id, setting_id))
            print("'league_settings' table anonymized.")
        except sqlite3.OperationalError:
            print("  Could not find 'league_settings' table, skipping.")
        
        # --- Clear sensitive tables ---
        sensitive_tables = ['manager_emails', 'manager_credentials', 'previews', 'summaries']
        for table in sensitive_tables:
            try:
                cursor.execute(f"DELETE FROM {table}")
                print(f"Clearing '{table}' table...done.")
            except sqlite3.OperationalError:
                print(f"  Table '{table}' does not exist, skipping.")

        # --- Ensure data for current year ---
        ensure_current_year_data(conn, cursor, fake)

        conn.commit()
        print("Database changes committed.")

    except sqlite3.Error as e:
        print(f"Database error: {e}")
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

if __name__ == '__main__':
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(project_root, 'data', 'fantasy_football.db')

    if not os.path.exists(db_path):
        print(f"Error: Input database not found at {db_path}")
    else:
        backup_path = db_path + '.bak'
        print(f"Creating a backup of the database at {backup_path}")
        shutil.copyfile(db_path, backup_path)
        
        print("\nStarting anonymization process...")
        anonymize_db(db_path)
        print("\nAnonymization process complete.")

