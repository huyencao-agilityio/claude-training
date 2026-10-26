#!/usr/bin/env bash
# PostToolUse hook for Edit/Write: formats the edited task-tracker file with prettier.
# Uses the prettier pinned in task-tracker/package.json; --no-install never downloads one.

file=$(jq -r '.tool_input.file_path // empty')
app="$CLAUDE_PROJECT_DIR/task-tracker"

# Only task-tracker files: .prettierrc and the pinned prettier live there, and course
# notes keep their own formatting
case "$file" in
  "$app"/*) ;;
  *) exit 0 ;;
esac

# Quoted as one argument, so a path with spaces stays one file
cd "$app" && npx --no-install prettier --write --ignore-unknown "$file" >/dev/null
