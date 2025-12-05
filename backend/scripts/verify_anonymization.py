import sqlite3
import os
import pandas as pd

def verify_anonymization(db_path):
    """
    Connects to the database and prints sample data from tables that should be anonymized
    to allow for visual verification.

    Args:
        db_path (str): The path to the SQLite database file.
    """
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        return

    print(f"Connecting to database: {db_path}")
    try:
        conn = sqlite3.connect(db_path)
        
        print("\n--- Verifying 'managers' table ---")
        try:
            managers_df = pd.read_sql_query("SELECT id, name_id, full_name, sleeper_username, sleeper_user_id, email, passcode FROM managers LIMIT 5", conn)
            print("Sample data from 'managers' table:")
            print(managers_df.to_string())
            
            # Check if any identifiable fields still look real
            if managers_df['sleeper_username'].str.contains('_', na=False).any():
                 print("\n[WARNING] Some 'sleeper_username' fields might still contain real-looking data.")

        except pd.io.sql.DatabaseError as e:
            print(f"Could not query 'managers' table: {e}")


        print("\n--- Verifying 'team_seasons' table ---")
        try:
            team_seasons_df = pd.read_sql_query("SELECT team_name FROM team_seasons LIMIT 5", conn)
            print("Sample data from 'team_seasons' table:")
            print(team_seasons_df.to_string())
        except pd.io.sql.DatabaseError as e:
            print(f"Could not query 'team_seasons' table: {e}")

        
        print("\n--- Verifying sensitive tables are empty ---")
        sensitive_tables = ['manager_emails', 'manager_credentials', 'previews', 'summaries']
        for table in sensitive_tables:
            try:
                df = pd.read_sql_query(f"SELECT * FROM {table} LIMIT 1", conn)
                if df.empty:
                    print(f"[OK] '{table}' table is empty.")
                else:
                    print(f"[WARNING] '{table}' table is NOT empty and may contain sensitive data.")
            except Exception as e:
                print(f"Could not query '{table}' table (this is expected if it was deleted): {e}")

    except sqlite3.Error as e:
        print(f"Database error: {e}")
    finally:
        if conn:
            conn.close()
            print("\nDatabase connection closed.")

if __name__ == '__main__':
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_file = os.path.join(project_root, 'data', 'fantasy_football.db')
    verify_anonymization(db_file)
