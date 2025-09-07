#!/usr/bin/env bash
set -euo pipefail

MODULE=${1:-"01-foundation"}
SESSION_NAME="istio-learning"

echo "🚀 Starting Istio PM Mastery learning session for Module $MODULE..."

# Kill existing session if it exists
tmux kill-session -t $SESSION_NAME 2>/dev/null || true

# Get the repository root directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Create new session in repo root
tmux new-session -d -s $SESSION_NAME -c "$REPO_ROOT"

# Split window vertically (left: commands, right: markdown)
tmux split-window -h -t $SESSION_NAME

# Set up left pane for commands - navigate to module directory
sleep 1  # Wait for shell to initialize
tmux send-keys -t $SESSION_NAME:0.0 "cd modules/$MODULE" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:0.0 "clear" Enter
sleep 0.5
tmux send-keys -t $SESSION_NAME:0.0 "echo '🔧 Command Terminal Ready - Follow the module instructions'" Enter
sleep 0.2
tmux send-keys -t $SESSION_NAME:0.0 "echo '📚 Reading: modules/$MODULE/README.md'" Enter
sleep 0.2

tmux send-keys -t $SESSION_NAME:0.0 "echo '💡 Use Ctrl-b + ← → to switch panes'" Enter
sleep 0.2
tmux send-keys -t $SESSION_NAME:0.0 "echo ''" Enter

# Set up right pane for markdown viewing - stay in repo root
sleep 0.5  # Wait for right pane to initialize
tmux send-keys -t $SESSION_NAME:0.1 "glow modules/$MODULE/README.md" Enter
sleep 1  # Wait for glow to finish outputting
tmux send-keys -t $SESSION_NAME:0.1 "Enter"  # Ensure we're at a prompt
sleep 0.5

# Dynamically resize panes to 40% (left) / 60% (right)
# Calculate based on current window width so it works on any terminal size
total_width=$(tmux display-message -p -t $SESSION_NAME:0 '#{window_width}')
left_width=$(( total_width * 40 / 100 ))
# Set left pane width; right pane automatically takes the remainder
tmux resize-pane -t $SESSION_NAME:0.0 -x $left_width

# Make left pane active for commands
tmux select-pane -t $SESSION_NAME:0.0

echo ""
echo "✅ Learning session created!"
echo ""
echo "📖 Left pane: Command terminal (~40% width)"
echo "📚 Right pane: Module content (~60% width, scroll with tmux)"
echo ""
echo "🎯 Tmux shortcuts:"
echo "   Ctrl-b + ←/→   Switch between panes"
echo "   Ctrl-b + z     Zoom/unzoom current pane"
echo "   Ctrl-b + d     Detach from session"
echo "   tmux attach    Reattach to session"
echo ""
echo "📚 Module content (right pane):"
echo "   Switch to right pane: Ctrl-b + →"
echo "   Enter scroll mode: Ctrl-b + ["
echo "   Then use arrow keys to scroll up/down"
echo "   Exit scroll mode: q or Enter"
echo ""
echo "Attaching to session..."
sleep 2

# Attach to the session
tmux attach-session -t $SESSION_NAME
