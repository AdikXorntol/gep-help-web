#!/usr/bin/env bash
# Serves web/ on http://127.0.0.1:${PORT:-8090}/ (used by the tests).
cd "$(dirname "$0")/../web" && exec python3 -m http.server "${PORT:-8090}" --bind 127.0.0.1
