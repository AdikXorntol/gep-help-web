#!/usr/bin/env bash
# Local check: fresh database, stub Supabase objects, schema.sql twice, then the RLS tests.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres tests/db/run_local.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
db="gep_ujian_$$"
psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "create database $db" >/dev/null
trap 'psql -X -q -d postgres -c "drop database if exists $db" >/dev/null' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"; }
run -f "$here/supabase_stub.sql" >/dev/null
run -f "$root/supabase/schema.sql" >/dev/null && echo "schema.sql pass 1: OK"
run -f "$root/supabase/schema.sql" >/dev/null && echo "schema.sql pass 2: OK"
out="$(run -At -F ' | ' -f "$root/supabase/test-rls.sql")"
echo "$out"
total=$(echo "$out" | grep -c ' | ' || true)
lulus=$(echo "$out" | grep -c '| LULUS$' || true)
echo "RLS: $lulus / $total LULUS"
[ "$total" -gt 0 ] && [ "$total" -eq "$lulus" ]
