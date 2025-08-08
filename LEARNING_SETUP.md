# 🖥️ Optimal Learning Environment Setup

Get the best learning experience with a split-screen terminal showing module content alongside your commands.

## 🚀 Quick Setup

### **One-Time Setup**
```bash
# Install tools and set up environment
./bin/setup_learning_environment.sh
```

### **Start Learning Session**
```bash
# Start with Module 1 (default)
./bin/start_learning_session.sh

# Or start with specific module
./bin/start_learning_session.sh 03-sidecar-vs-ambient
```

## 📖 What You Get

### **Split-Screen Terminal Layout**
```
┌──────────────────────┬─────────────────────────────────────────────┐
│                      │                                             │
│  🔧 Command Terminal │          📚 Module Content                 │
│                      │                                             │
│  $ make kind-up      │  # Module 1: Customer Context & Networking │
│  $ kubectl get pods  │                                             │
│  $ make istio-sidecar│  ## The Customer Problem                   │
│                      │                                             │
│  Follow module       │  Meet **Sarah Martinez**, Principal        │
│  instructions here   │  Security Architect at MegaBank Corp...    │
│  with live commands  │                                             │
│                      │  (Scrollable with ↑↓, wider for reading)   │
└──────────────────────┴─────────────────────────────────────────────┘
```

### **Efficient Workflow**
- **Left pane (40%)**: Run commands and follow exercises
- **Right pane (60%)**: Read module content with beautiful markdown rendering in pager mode
- **No switching**: Everything visible at once, optimized for reading
- **Smart navigation**: Easy pane switching and module progression

## 🎮 Controls and Navigation

### **Tmux Controls**
- `Ctrl-b + ←/→` - Switch between panes
- `Ctrl-b + z` - Zoom/unzoom current pane (full screen)
- `Ctrl-b + d` - Detach from session (keeps running)
- `tmux attach` - Reattach to your session

### **Glow (Markdown Viewer) Controls**
- `↑↓` - Scroll up/down
- `PgUp/PgDn` - Page up/down
- `Home/End` - Go to top/bottom
- `q` - Quit viewer
- `?` - Show help

### **📋 Copying Code Blocks**
Since Glow doesn't have built-in copy functionality, use terminal selection:

**macOS:**
- **Select text**: Hold `Shift` + drag to select code block
- **Copy**: `Cmd + C`
- **Paste in left pane**: `Cmd + V`

**Linux/Windows:**
- **Select text**: Hold `Shift` + drag to select code block  
- **Copy**: `Ctrl + Shift + C`
- **Paste in left pane**: `Ctrl + Shift + V`

**Pro tips:**
- **Double-click** to select entire words/commands quickly
- **Triple-click** to select entire lines
- **Hold `Shift` and use arrow keys** for precise selection
- **Select code blocks** by dragging from start of `kubectl` to end of command

### **Module Navigation**
```bash
# Switch to next module (run from outside tmux)
./bin/switch_module.sh 02-service-mesh-value

# Or inside your session, just run glow directly
glow ../02-service-mesh-value/README.md
```

## 🛠️ Advanced Usage

### **Multiple Sessions**
```bash
# Create additional session for experimentation
tmux new-session -d -s istio-experiments

# List all sessions
tmux list-sessions

# Attach to specific session
tmux attach-session -t istio-experiments
```

### **Save Your Progress**
Your tmux session persists even if you close the terminal:
```bash
# Detach but keep session running
Ctrl-b + d

# Later, reattach
tmux attach-session -t istio-learning
```

### **Custom Layout**
```bash
# If you prefer horizontal split
tmux kill-session -t istio-learning
tmux new-session -d -s istio-learning
tmux split-window -v  # Horizontal split instead of vertical

# Adjust pane sizes if needed
tmux resize-pane -t istio-learning:0.0 -x 50  # Command pane (40%)
tmux resize-pane -t istio-learning:0.1 -x 75  # Markdown pane (60%, wider)
```

## 📱 Alternative: Warp Terminal

If you use [Warp Terminal](https://www.warp.dev/), it has built-in markdown rendering:

1. Open Warp
2. Run: `cat modules/01-foundation/README.md`
3. Warp will offer to open in split pane
4. Accept for side-by-side view

## 🔧 Troubleshooting

### **Glow not displaying properly**
```bash
# Update terminal settings
export TERM=xterm-256color

# Or try alternative renderer
brew install mdcat
mdcat modules/01-foundation/README.md
```

### **Tmux session lost**
```bash
# List existing sessions
tmux list-sessions

# If session exists, attach
tmux attach-session -t istio-learning

# If no sessions, start new one
./bin/start_learning_session.sh
```

### **Window too small**
```bash
# Resize panes for better balance
tmux resize-pane -t istio-learning:0.0 -x 60  # Command pane width
tmux resize-pane -t istio-learning:0.1 -x 80  # Markdown pane width
```

## 🎯 Ready to Learn?

Once set up, your learning workflow becomes:

1. **Start session**: `./bin/start_learning_session.sh`
2. **Read module** in right pane (scroll with ↑↓)
3. **Run commands** in left pane following the instructions
4. **Switch modules**: `./bin/switch_module.sh 02-service-mesh-value`
5. **Continue** through all 8 modules progressively

This creates an immersive, efficient learning experience where you can see instructions and run commands simultaneously!

**Ready to begin?**
```bash
./bin/start_learning_session.sh
```
