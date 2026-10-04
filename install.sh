#!/bin/sh
set -eu

usage() {
  printf '%s\n' \
    'Install Context Atlas using OpenCode v2 (2.0.22 or newer).' \
    'Usage: sh install.sh [--help]' \
    'Set OPENCODE_BIN to an explicit OpenCode v2 executable if needed.' \
    'No separate Node.js, npm or Bun installation is required.'
}

compatible() {
  version=$("$1" --version 2>/dev/null) || return 1
  version=${version#opencode }
  version=${version#v}
  version=${version%%-*}
  version=${version%%+*}
  case "$version" in
    2.*.*) ;;
    *) return 1 ;;
  esac
  remainder=${version#2.}
  minor=${remainder%%.*}
  patch=${remainder#*.}
  case "$minor:$patch" in
    *[!0-9:]*|:*|*:) return 1 ;;
  esac
  [ "$minor" -gt 0 ] || [ "$patch" -ge 22 ]
}

main() {
  if [ "$#" -gt 0 ]; then
    if [ "$#" -eq 1 ] && [ "$1" = '--help' ]; then
      usage
      return
    fi
    usage >&2
    exit 2
  fi

  binary=${OPENCODE_BIN:-}
  if [ -n "$binary" ]; then
    if ! compatible "$binary"; then
      printf '%s\n' 'OPENCODE_BIN must point to OpenCode v2, version 2.0.22 or newer.' >&2
      exit 1
    fi
  else
    for candidate in opencode opencode2; do
      if command -v "$candidate" >/dev/null 2>&1 && compatible "$candidate"; then
        binary=$candidate
        break
      fi
    done
    if [ -z "$binary" ]; then
      printf '%s\n' \
        'OpenCode v2 (2.0.22 or newer) was not found.' \
        'Install it from https://opencode.ai/v2/docs/ or set OPENCODE_BIN.' >&2
      exit 1
    fi
  fi

  printf 'Installing Context Atlas with %s…\n' "$binary"
  "$binary" plugin add github:LerikP/opencode-context-atlas
  printf '\n%s\n' \
    'Installed Context Atlas. Restart OpenCode and send one message, then run /context or /atlas.' \
    'Optional: add "-opencode.sidebar.context" to plugins in cli.json to replace the built-in indicator.'
}

main "$@"
