#!/usr/bin/env bash
# Fails if the frontend contains mock/fixture data. Run before every push and in the final gate.
# Rule: every value on screen comes from the API. Domain lists (statuses, periods, methods, roles)
# come from GET /api/v1/meta, never from hardcoded arrays.
set -u
ROOT="${1:-frontend}"
[ -d "$ROOT" ] || { echo "no $ROOT dir"; exit 2; }
fail=0
scan() { # description, regex
  hits=$(grep -rEn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
         --exclude-dir=node_modules --exclude-dir=.next --exclude='*.test.*' -e "$2" "$ROOT" || true)
  if [ -n "$hits" ]; then echo "✗ $1"; echo "$hits" | head -8; fail=1; fi
}
scan "mock/fixture/faker words"            '(mock|fixture|faker|dummy|lorem ipsum|sampleData|fakeData|placeholderData)'
scan "JSON data imported into the UI"      "from ['\"][^'\"]+\.json['\"]|require\(['\"][^'\"]+\.json['\"]\)"
scan "hardcoded record arrays (id: ...)"   '\[\s*\{\s*(id|number|name)\s*:'
scan "hardcoded money/status literals"     "status: ?['\"](active|paid|draft|confirmed|overdue)['\"]"
scan "setTimeout used to fake loading"     'setTimeout\([^)]*(resolve|set[A-Z])'
[ $fail -eq 0 ] && echo "✓ no mock data found in $ROOT"
exit $fail
