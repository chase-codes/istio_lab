#!/usr/bin/env bash
set -euo pipefail

MODULE=${1:-}
SESSION_NAME="istio-learning"

if [ -z "$MODULE" ]; then
    echo "Usage: $0 <module-number>"
    echo "Example: $0 02-service-mesh-value"
    echo ""
    echo "Available modules:"
    ls -1 modules/ | grep -E '^[0-9]' | sed 's/^/  /'
    exit 1
fi

if [ ! -d "modules/$MODULE" ]; then
    echo "❌ Module 'modules/$MODULE' not found"
    echo ""
    echo "Available modules:"
    ls -1 modules/ | grep -E '^[0-9]' | sed 's/^/  /'
    exit 1
fi

echo "🔄 Switching to Module $MODULE..."

# If no session, start a new one
if ! tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "❌ No active learning session found. Starting new session..."
    ./bin/start_learning_session.sh $MODULE
    exit 0
fi

# Update left pane (command terminal)
tmux send-keys -t $SESSION_NAME:0.0 C-c  # Cancel any running command
tmux send-keys -t $SESSION_NAME:0.0 "cd ../modules/$MODULE" Enter
tmux send-keys -t $SESSION_NAME:0.0 "clear" Enter
tmux send-keys -t $SESSION_NAME:0.0 "echo '🔧 Switched to Module $MODULE'" Enter
tmux send-keys -t $SESSION_NAME:0.0 "echo '📚 Reading: modules/$MODULE/README.md'" Enter
tmux send-keys -t $SESSION_NAME:0.0 "echo ''" Enter

# Update right pane (markdown viewer)
tmux send-keys -t $SESSION_NAME:0.1 "q"  # Quit current glow
tmux send-keys -t $SESSION_NAME:0.1 "glow -p modules/$MODULE/README.md" Enter

# Ensure dynamic 40/60 pane sizing remains
total_width=$(tmux display-message -p -t $SESSION_NAME:0 '#{window_width}')
left_width=$(( total_width * 40 / 100 ))
tmux resize-pane -t $SESSION_NAME:0.0 -x $left_width

echo "✅ Switched to Module $MODULE"
echo "📖 Use 'tmux attach' to return to your learning session"
