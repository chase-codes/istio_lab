import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { LigaturesAddon } from '@xterm/addon-ligatures';
// import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import '../styles/Terminal.css';

function Terminal({ module }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const searchAddonRef = useRef(null);
  const initializedRef = useRef(false);
  const [sessionId] = useState(() => `terminal-${Math.random().toString(36).substr(2, 9)}`);
  const [debug, setDebug] = useState({ opened: false, ptyStarted: false, receivedData: false });

  useEffect(() => {
    if (!initializedRef.current && terminalRef.current) {
      initializedRef.current = true;
      initializeTerminal();
    }

    const beforeUnload = () => {
      try { window.electronAPI?.killPty(sessionId); } catch (_) {}
      try { xtermRef.current?.dispose(); } catch (_) {}
    };
    window.addEventListener('beforeunload', beforeUnload);

    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      // Avoid disposing/kill during React 18 StrictMode dev double-mount; rely on beforeunload
    };
  }, [sessionId]);

  useEffect(() => {
    if (module && window.electronAPI && xtermRef.current) {
      xtermRef.current.write(`\r\n\x1b[32m➜ Switched to module: ${module}\x1b[0m\r\n`);
    }
  }, [module]);

  const initializeTerminal = async () => {
    try {
      // eslint-disable-next-line no-console
      console.log('[Terminal] init start', { sessionId });
      const terminal = new XTerm({
        fontSize: 14,
        fontFamily: '"SFMono Nerd Font", "MesloLGS NF", "FiraCode Nerd Font", "Hack Nerd Font", Menlo, Monaco, "Ubuntu Mono", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          selection: 'rgba(255, 255, 255, 0.3)',
          black: '#1e1e1e',
          red: '#f44747',
          green: '#6a9955',
          yellow: '#dcdcaa',
          blue: '#4fc1ff',
          magenta: '#c586c0',
          cyan: '#4ec9b0',
          white: '#d4d4d4',
          brightBlack: '#7f7f7f',
          brightRed: '#f44747',
          brightGreen: '#6a9955',
          brightYellow: '#dcdcaa',
          brightBlue: '#4fc1ff',
          brightMagenta: '#c586c0',
          brightCyan: '#4ec9b0',
          brightWhite: '#ffffff'
        },
        cursorBlink: true,
        scrollback: 1000,
        allowTransparency: false
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();
      const ligaturesAddon = new LigaturesAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.loadAddon(searchAddon);
      terminal.loadAddon(ligaturesAddon);

      terminal.open(terminalRef.current);
      setDebug(d => ({ ...d, opened: true }));
      setTimeout(() => {
        try { fitAddon.fit(); } catch (_) {}
        try { terminal.focus(); } catch (_) {}
        try {
          terminal.write('\x1b[36mInitializing terminal...\x1b[0m\r\n');
          terminal.refresh(0, terminal.rows - 1);
        } catch (_) {}
      }, 100);
      requestAnimationFrame(() => { try { fitAddon.fit(); } catch (_) {} });

      xtermRef.current = terminal;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      terminal.onData(data => {
        // Local echo to ensure visible typing even before shell responds
        try { terminal.write(data); } catch (_) {}
        window.electronAPI?.writePty(sessionId, data);
      });

      setTimeout(async () => {
        try {
          const repoRoot = await window.electronAPI.getRepoRoot();
          // eslint-disable-next-line no-console
          console.log('[Terminal] starting PTY at', repoRoot);
          await window.electronAPI.startPty(sessionId, { cwd: repoRoot });
          setDebug(d => ({ ...d, ptyStarted: true }));
          window.electronAPI.onPtyData(sessionId, data => {
            // eslint-disable-next-line no-console
            // console.log('[Terminal] pty:data len', data?.length);
            terminal.write(data);
            setDebug(d => (d.receivedData ? d : { ...d, receivedData: true }));
          });
          window.electronAPI.onPtyExit(sessionId, () => terminal.write('\r\n\x1b[31m[session ended]\x1b[0m\r\n'));
          terminal.write('\x1b[36mIstio Lab Terminal ready. Type commands or use Run on code blocks.\x1b[0m\r\n');
          // Trigger a simple output to verify rendering
          window.electronAPI.writePty(sessionId, 'echo __ISTIO_TERMINAL_READY__\r');
          // Normalize prompt and locale for better rendering and simpler glyphs
          window.electronAPI.writePty(sessionId, 'export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8\r');
          window.electronAPI.writePty(sessionId, 'if [ -n "$ZSH_VERSION" ]; then PROMPT="%n@%m %1~ %# "; fi\r');
          window.electronAPI.writePty(sessionId, 'if [ -n "$BASH_VERSION" ]; then PS1="\\u@\\h \\W \\$ "; fi\r');
        } catch (err) {
          try { terminal.write(`\r\n\x1b[31mFailed to start shell: ${String(err)}\x1b[0m\r\n`); } catch (_) {}
          // eslint-disable-next-line no-console
          console.error('[Terminal] PTY failed', err);
        }
      }, 150);

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize terminal:', error);
    }
    // WebGL renderer disabled temporarily for debugging rendering issues

  };

  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    // Observe size changes of the terminal container to refit when it becomes visible
    const ro = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        try { fitAddonRef.current.fit(); } catch (_) {}
      }
    });
    if (terminalRef.current) ro.observe(terminalRef.current);
    // Listen for run requests from markdown
    const runListener = (e) => {
      const text = e.detail?.text || '';
      if (text) {
        try { xtermRef.current?.focus(); } catch (_) {}
        // Normalize and execute line by line (strip leading prompts)
        const lines = text
          .replace(/\r/g, '')
          .split('\n')
          .map(l => l.replace(/^\s*[#$>]\s?/, '').trim())
          .filter(l => l.length);
        for (const line of lines) {
          window.electronAPI?.writePty(sessionId, line + '\r');
        }
      }
    };
    window.addEventListener('terminal:run', runListener);

    // Native paste support
    const onPaste = (ev) => {
      const paste = ev.clipboardData?.getData('text') || '';
      if (paste) {
        window.electronAPI?.writePty(sessionId, paste);
        ev.preventDefault();
      }
    };
    terminalRef.current?.addEventListener('paste', onPaste);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('terminal:run', runListener);
      terminalRef.current?.removeEventListener('paste', onPaste);
      try { ro.disconnect(); } catch (_) {}
    };
  }, []);

  const clearTerminal = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span>Terminal - Module: {module}</span>
        <div className="terminal-controls">
          <button
            className="terminal-button"
            onClick={() => {
              // Simple prompt-based search
              const query = window.prompt('Search terminal:');
              if (query && xtermRef.current) {
                try {
                  searchAddonRef.current?.findNext(query);
                } catch (_) {}
              }
            }}
            title="Search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
          <button
            className="terminal-button"
            onClick={clearTerminal}
            title="Clear terminal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
            </svg>
          </button>
        </div>
      </div>
      <div
        ref={terminalRef}
        className="terminal"
        tabIndex={0}
        onClick={() => { try { xtermRef.current?.focus(); } catch (_) {} }}
      />
      {(!debug.receivedData) && (
        <div style={{ position: 'absolute', bottom: 6, right: 8, color: '#777', fontSize: '12px' }}>
          {debug.opened ? 'waiting for shell…' : 'opening…'}
        </div>
      )}
    </div>
  );
}

export default Terminal;


