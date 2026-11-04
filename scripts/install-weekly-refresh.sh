#!/usr/bin/env bash
# Installs (or with --uninstall removes) the macOS launchd agent that runs scripts/weekly-refresh.sh
# every Monday at 06:00 local time. A run missed while the Mac sleeps starts when it wakes up.
set -euo pipefail

label="ar.congreso-abierto.weekly-refresh"
plist="$HOME/Library/LaunchAgents/$label.plist"
logdir="$HOME/Library/Logs/congreso-abierto"
repo="$(cd "$(dirname "$0")/.." && pwd)"
domain="gui/$(id -u)"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "$domain/$label" 2>/dev/null || true
  rm -f "$plist"
  echo "Removed $label"
  exit 0
fi

# launchd starts agents with a minimal PATH: keep the directories of the tools this shell uses.
path_dirs=""
for tool in node npm git gh; do
  dir="$(dirname "$(command -v "$tool")")"
  case ":$path_dirs:" in *":$dir:"*) ;; *) path_dirs="${path_dirs:+$path_dirs:}$dir" ;; esac
done
path_dirs="$path_dirs:/usr/bin:/bin"

mkdir -p "$(dirname "$plist")" "$logdir"
cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$repo/scripts/weekly-refresh.sh</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$path_dirs</string><key>HOME</key><string>$HOME</string></dict>
  <key>StandardOutPath</key><string>$logdir/weekly-refresh.log</string>
  <key>StandardErrorPath</key><string>$logdir/weekly-refresh.log</string>
</dict>
</plist>
PLIST

launchctl bootout "$domain/$label" 2>/dev/null || true
launchctl bootstrap "$domain" "$plist"
echo "Installed $label: Mondays 06:00, log $logdir/weekly-refresh.log"
echo "Run it now with: launchctl kickstart -k $domain/$label"
