import sqlite3
import shutil
from faker import Faker

def anonymize_db(input_db_path, output_db_path):
    """
    Anonymizes a fantasy football database by replacing personally identifiable information (PII)
    with fake data.

    Args:
        input_db_path (str): The path to the input SQLite database file.
        output_db_path (str): The path where the anonymized database will be saved.
    """
    if input_db_path != output_db_path:
        print(f"Copying database from {input_db_path} to {output_db_path}...")
        try:
            shutil.copyfile(input_db_path, output_db_path)
            print("Database copied successfully.")
        except IOError as e:
            print(f"Error copying database: {e}")
            return
    else:
        print("Input and output paths are the same. Modifying database in-place.")

    fake = Faker()
    
    try:
        print(f"Connecting to the anonymized database at {output_db_path}...")
        conn = sqlite3.connect(output_db_path)
        cursor = conn.cursor()
        print("Database connection successful.")

        # --- Anonymize 'managers' table ---
        print("Anonymizing 'managers' table...")
        cursor.execute("SELECT id, name_id FROM managers")
        managers = cursor.fetchall()
        
        name_id_map = {}
        used_new_name_ids = set()

        for manager in managers:
            manager_id, old_name_id = manager
            
            # Generate a unique new name_id
            new_name_id = fake.user_name()
            while new_name_id in used_new_name_ids:
                new_name_id = fake.user_name()
            used_new_name_ids.add(new_name_id)

            name_id_map[old_name_id] = new_name_id

            new_full_name = fake.name()
            new_sleeper_username = fake.user_name()
            new_sleeper_user_id = str(fake.random_number(digits=18, fix_len=True))
            new_email = fake.email()
            
            print(f"  Updating manager ID {manager_id}: {old_name_id} -> {new_name_id}")
            
            cursor.execute("""
                UPDATE managers
                SET name_id = ?,
                    full_name = ?,
                    sleeper_username = ?,
                    sleeper_user_id = ?,
                    email = ?,
                    passcode = NULL
                WHERE id = ?
            """, (new_name_id, new_full_name, new_sleeper_username, new_sleeper_user_id, new_email, manager_id))

        print("'managers' table anonymized.")

        # --- Update 'team_seasons' with new name_ids ---
        print("Updating 'name_id' in 'team_seasons' table...")
        for old_name_id, new_name_id in name_id_map.items():
            cursor.execute("UPDATE team_seasons SET name_id = ? WHERE name_id = ?", (new_name_id, old_name_id))
        print("'team_seasons' name_ids updated.")


        # --- Anonymize 'team_seasons' table ---
        print("Anonymizing 'team_seasons' team names...")
        cursor.execute("SELECT id, team_name FROM team_seasons")
        team_seasons = cursor.fetchall()

        for season in team_seasons:
            season_id, old_team_name = season
            if old_team_name:
                new_team_name = f"{fake.word().capitalize()} {fake.word().capitalize()}"
                print(f"  Updating team season ID {season_id}: team name -> {new_team_name}")
                cursor.execute("UPDATE team_seasons SET team_name = ? WHERE id = ?", (new_team_name, season_id))
        
        print("'team_seasons' team names anonymized.")

        # --- Anonymize 'league_settings' table ---
        print("Anonymizing 'league_settings' table...")
        try:
            cursor.execute("SELECT id, league_id FROM league_settings")
            settings = cursor.fetchall()
            for setting in settings:
                setting_id, old_league_id = setting
                if old_league_id:
                    new_league_id = str(fake.random_number(digits=10, fix_len=True))
                    print(f"  Updating league_settings ID {setting_id}: league_id -> {new_league_id}")
                    cursor.execute("UPDATE league_settings SET league_id = ? WHERE id = ?", (new_league_id, setting_id))
            print("'league_settings' table anonymized.")
        except sqlite3.OperationalError:
            print("  Could not find 'league_settings' table, skipping.")
        
        # --- Clear sensitive tables ---
        sensitive_tables = ['manager_emails', 'manager_credentials', 'previews', 'summaries']
        for table in sensitive_tables:
            try:
                print(f"Clearing '{table}' table...")
                cursor.execute(f"DELETE FROM {table}")
                print(f"'{table}' table cleared.")
            except sqlite3.OperationalError:
                print(f"  Table '{table}' does not exist, skipping.")

        conn.commit()
        print("Database changes committed.")

    except sqlite3.Error as e:
        print(f"Database error: {e}")
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")
        print("\nAnonymization process complete.")
        print(f"Anonymized database saved to: {output_db_path}")

if __name__ == '__main__':
    import os

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # The user is now providing the original DB in the final location
    original_db = os.path.join(project_root, 'data', 'fantasy_football.db')
    # We will work on this file in-place
    anonymized_db = original_db

    if not os.path.exists(original_db):
        print(f"Error: Input database not found at {original_db}")
        print("Please make sure the database file exists.")
    else:
        # We pass the same path for input and output to modify the file in-place,
        # but the function first creates a copy, so the original is not lost until the end.
        # Let's make a backup first to be safe.
        backup_path = original_db + '.bak'
        print(f"Creating a backup of the original database at {backup_path}")
        shutil.copyfile(original_db, backup_path)
        
        anonymize_db(original_db, anonymized_db)

