#!/usr/bin/env bash
# PreToolUse hook for Bash: blocks `rm -rf`, `git push --force` and `DROP TABLE/DATABASE`.
# Exit 2 blocks the command and sends stderr back to Claude.

cmd=$(jq -r '.tool_input.command // ""')

block() {
  echo "Blocked: $1. Ask the user to run it themselves if it is really needed." >&2
  exit 2
}

# rm with both a recursive and a force flag, in any form: -rf, -fr, -r -f, --recursive --force
if echo "$cmd" | grep -Eq '(^|[;&|[:space:]])rm[[:space:]]'; then
  if echo "$cmd" | grep -Eq '[[:space:]](-[a-zA-Z]*r[a-zA-Z]*|--recursive)([[:space:]]|$)' &&
     echo "$cmd" | grep -Eq '[[:space:]](-[a-zA-Z]*f[a-zA-Z]*|--force)([[:space:]]|$)'; then
    block "rm -rf"
  fi
fi

# git push with --force, --force-with-lease or -f
if echo "$cmd" | grep -Eq 'git[[:space:]]+push' &&
   echo "$cmd" | grep -Eq '[[:space:]](--force(-with-lease)?(=[^[:space:]]*)?|-f)([[:space:]]|$)'; then
  block "git push --force"
fi

# SQL that drops a table or database, any letter case
if echo "$cmd" | grep -Eiq 'drop[[:space:]]+(table|database)'; then
  block "DROP TABLE/DATABASE"
fi

exit 0
