import sqlite3

DB = "hugamara.db"

con = sqlite3.connect(DB)
cur = con.cursor()

cur.execute(
    "select name from sqlite_master where type='table' and name in ('permissions','role_permissions','user_locations','refresh_tokens') order by name"
)
print("phase2 tables:", cur.fetchall())

for t in ["permissions", "role_permissions", "user_locations", "refresh_tokens"]:
    cur.execute(f"PRAGMA table_info('{t}')")
    cols = cur.fetchall()
    print("\n", t, "cols:")
    for c in cols:
        print("  ", c)

con.close()
