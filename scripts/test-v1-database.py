"""Run the full migration chain in a new local-only database, preserving dev data."""
import argparse
import pathlib
import re
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTAINER = "supabase_db_cfa-platform"

def docker(*args, sql=None):
    result = subprocess.run(["docker", "exec", "-i", CONTAINER, *args], input=sql,
                            capture_output=True, text=True, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout

def query(database, sql):
    return docker("psql", "-X", "-U", "postgres", "-d", database,
                  "-v", "ON_ERROR_STOP=1", "-q", sql=sql)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--through", default="9999")
    parser.add_argument("--tests", nargs="*", default=[])
    args = parser.parse_args()
    database = f"cfa_v1_test_{time.time_ns()}"
    query("postgres", f'CREATE DATABASE "{database}" TEMPLATE template0;')
    print(f"Disposable database: {database}", flush=True)
    auth = docker("pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only",
                  "--no-owner", "--no-privileges", "--schema=auth")
    # Project-owned triggers are recreated by the migration chain below.
    auth = re.sub(r"^CREATE TRIGGER .*EXECUTE FUNCTION public\..*;\n?", "", auth, flags=re.M)
    query(database, auth)
    query(database, f"""
      CREATE SCHEMA IF NOT EXISTS extensions;
      CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
      CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
      GRANT USAGE ON SCHEMA public,auth,extensions TO anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon,authenticated,service_role;
      ALTER DATABASE "{database}" SET search_path TO public,extensions;
    """)
    for path in sorted((ROOT / "supabase/migrations").glob("[0-9]*.sql")):
        if path.name[:4] > args.through:
            continue
        query(database, "BEGIN;\n" + path.read_text(encoding="utf-8-sig") + "\nCOMMIT;")
        print(f"Applied {path.name}", flush=True)
    query(database, (ROOT / "supabase/seed.sql").read_text(encoding="utf-8-sig"))
    print("Synthetic seed applied", flush=True)
    for name in args.tests:
        path = (ROOT / "supabase/tests/database" / name).resolve()
        if path.parent != (ROOT / "supabase/tests/database").resolve() or path.suffix != ".sql":
            raise ValueError("Tests must be named SQL files in supabase/tests/database")
        output = query(database, path.read_text(encoding="utf-8-sig"))
        print(output, flush=True)
        if re.search(r"not ok|Looks like you failed|planned \d+ tests but ran", output):
            raise RuntimeError(f"pgTAP failure: {name}")
    print("Requested database checks passed. Database retained for inspection.", flush=True)

if __name__ == "__main__":
    main()
