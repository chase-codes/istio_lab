#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Setting up your Istio PM Mastery learning environment..."

# Install glow if not present
if ! command -v glow >/dev/null 2>&1; then
    echo "📖 Installing glow markdown renderer..."
    brew install glow
else
    echo "✅ glow already installed"
fi

# Install tmux if not present
if ! command -v tmux >/dev/null 2>&1; then
    echo "🔀 Installing tmux for split-screen terminal..."
    brew install tmux
else
    echo "✅ tmux already installed"
fi

echo ""
echo "🎯 Learning environment ready!"
echo ""
echo "To start your learning experience with split-screen markdown:"
echo ""
echo "1. Start tmux session:"
echo "   tmux new-session -d -s istio-learning"
echo ""
echo "2. Split screen vertically:"
echo "   tmux split-window -h"
echo ""
echo "3. In the right pane, view module content:"
echo "   tmux send-keys -t istio-learning:0.1 'glow modules/01-foundation/README.md' Enter"
echo ""
echo "4. In the left pane, run commands:"
echo "   tmux send-keys -t istio-learning:0.0 'cd modules/01-foundation' Enter"
echo ""
echo "5. Attach to the session:"
echo "   tmux attach-session -t istio-learning"
echo ""
echo "Or use the quick start script:"
echo "   ./bin/start_learning_session.sh"
echo ""
