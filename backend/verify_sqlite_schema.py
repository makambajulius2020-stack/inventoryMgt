import os
import sqlite3

DB = "hugamara.db"

print("db exists:", os.path.exists(DB))
con = sqlite3.connect(DB)
cur = con.cursor()

cur.execute("select name from sqlite_master where type='table' order by name")
tables = [r[0] for r in cur.fetchall()]
print("tables:", tables)

check_tables = [
    "requisitions",
    "lpos",
    "grns",
    "invoices",
    "payments",
    "inventory_movements",
]

for t in check_tables:
    cur.execute(f"PRAGMA index_list('{t}')")
    idx = cur.fetchall()
    print("\n", t, "indexes:")
    for row in idx:
        print("  ", row)

con.close()
