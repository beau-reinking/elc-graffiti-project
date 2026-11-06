#!/bin/zsh
set -e
cd -- "$(dirname -- "$0")"
if ! command -v npm >/dev/null 2>&1; then
  print "Yudo needs Node.js 22 or newer. Install Node.js, then open this launcher again."
  read "?Press Return to close."
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci
fi
print "Starting Yudo at http://127.0.0.1:5178"
print "Keep this window open. Press Control-C to stop the app."
npm start
