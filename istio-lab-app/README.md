# Istio PM Mastery Lab App

A modern desktop application for the Istio PM Mastery learning experience, built with Electron and React.

## Features

- **Split-pane layout**: Markdown documentation on the left, interactive terminal on the right
- **Rich markdown rendering**: Syntax highlighting, tables, images, and formatted content
- **Copyable code blocks**: Click the copy button to copy code snippets to clipboard
- **Integrated terminal**: Real terminal with command history and navigation
- **Module navigation**: Easy switching between learning modules
- **Cross-platform**: Works on macOS, Windows, and Linux

## Development Setup

### Prerequisites

- Node.js 16+ and npm
- The main istio_lab repository (this app expects modules to be in `../modules/`)

### Installation

```bash
# Install dependencies
npm install

# Start development mode (opens Electron app with hot reload)
npm run dev

# Or build and run production version
npm run build
npm start
```

### Project Structure

```
istio-lab-app/
├── main.js              # Electron main process
├── preload.js           # Secure IPC bridge
├── src/
│   ├── components/      # React components
│   │   ├── MarkdownViewer.js
│   │   ├── Terminal.js
│   │   └── ModuleNavigator.js
│   ├── styles/          # CSS stylesheets
│   └── index.js         # React entry point
├── webpack.config.js    # Build configuration
└── package.json
```

## Key Components

### MarkdownViewer
- Renders markdown with GitHub Flavored Markdown support
- Syntax highlighting for code blocks
- Copy-to-clipboard functionality for code snippets
- Support for tables, images, and rich formatting

### Terminal
- Real terminal integration using xterm.js
- Command execution through Electron's main process
- Automatic directory navigation to current module
- Command history with up/down arrow navigation

### ModuleNavigator
- Dropdown to switch between learning modules
- Automatically detects available modules from the filesystem

## Building for Distribution

```bash
# Build for current platform
npm run dist

# Build for all platforms
npm run dist:all
```

## Usage

1. **Start the app**: Run `npm run dev` for development or `npm start` for production
2. **Select a module**: Use the dropdown in the header to choose a learning module
3. **Read documentation**: The left pane shows the module's README with rich formatting
4. **Run commands**: Use the right pane terminal to execute lab exercises
5. **Copy code**: Click the 📋 button on any code block to copy it to clipboard

## Technical Details

### Electron Security
- Uses context isolation and preload scripts for security
- IPC communication is properly secured
- No Node.js integration in renderer process

### Terminal Integration
- Commands are executed in the main process for security
- Working directory is automatically set to the current module
- Full shell support with environment variables

### Markdown Features
- GitHub Flavored Markdown support
- Syntax highlighting with highlight.js
- Table rendering
- Image display
- Custom code block styling with copy functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
