import sqlite3

DB = "hugamara.db"

def main() -> None:
    con = sqlite3.connect(DB)
    cur = con.cursor()

    cur.execute(
        "select name from sqlite_master where type='table' and name like 'portioning_%' order by name"
    )
    print("portioning tables:", cur.fetchall())

    for t in [
        "portioning_batches",
        "portioning_input_lines",
        "portioning_output_lines",
        "portioning_loss_lines",
    ]:
        cur.execute(f"PRAGMA table_info('{t}')")
        print("\n", t, "cols:")
        for row in cur.fetchall():
            print("  ", row)

    con.close()


if __name__ == "__main__":
    main()
