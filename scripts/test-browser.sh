#!/usr/bin/env sh
set -eu
python3 -m http.server 8765 --bind 127.0.0.1 --directory tests/browser > /tmp/libwimm-browser-server.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM
python3 - <<'PY'
import time, urllib.request
for attempt in range(50):
    try:
        urllib.request.urlopen('http://127.0.0.1:8765', timeout=1).close()
        break
    except OSError:
        time.sleep(0.1)
else:
    raise SystemExit('Browser test server did not start; see /tmp/libwimm-browser-server.log')
PY
python3 tests/browser/test_browser.py "$@"
