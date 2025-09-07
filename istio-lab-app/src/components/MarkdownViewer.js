import React, { useState, useEffect, useCallback, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import '../styles/MarkdownViewer.css';
import DOMPurify from 'dompurify';

function MarkdownViewer({ module }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  // Delegated copy handler to avoid inline events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onClick = (e) => {
      const copyBtn = e.target.closest('.copy-button');
      if (copyBtn) {
        const codeId = copyBtn.getAttribute('data-code-id');
        const codeElement = document.getElementById(codeId);
        if (codeElement) {
          const text = codeElement.textContent || codeElement.innerText;
          navigator.clipboard.writeText(text).catch(() => {});
        }
        return;
      }
      const runBtn = e.target.closest('.run-button');
      if (runBtn) {
        const codeId = runBtn.getAttribute('data-code-id');
        const codeElement = document.getElementById(codeId);
        if (codeElement) {
          const text = codeElement.textContent || codeElement.innerText;
          window.dispatchEvent(new CustomEvent('terminal:run', { detail: { text } }));
        }
        return;
      }
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    // Configure marked for syntax highlighting
    marked.setOptions({
      highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      },
      breaks: true,
      gfm: true
    });
  }, []);

  useEffect(() => {
    if (module) {
      loadModuleContent();
    }
  }, [module, loadModuleContent]);

  const loadModuleContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (window.electronAPI) {
        // Try to load real content
        const modulesPath = await window.electronAPI.getModulesPath();
        const readmePath = `${modulesPath}/${module}/README.md`;
        const fileContent = await window.electronAPI.readFile(readmePath);
        setContent(fileContent);
      } else {
        // Fallback to mock content for development
        const mockContent = `# Module: ${module}

## Customer Problem

This is a sample module showing the layout and functionality.

### Key Features
- Rich markdown rendering
- Code blocks with syntax highlighting

## Lab Exercises

\`\`\`bash
# Example command
kubectl get pods
\`\`\`

## Next Steps

Continue to the next module for more advanced topics.
`;
        setContent(mockContent);
      }
    } catch (err) {
      console.warn('Failed to load real content, using fallback:', err.message);
      // Fallback to mock content if file loading fails
      const fallbackContent = `# Module: ${module}

## Content Loading Error

Could not load the README file for this module.

**Error**: ${err.message}

### Available Features
- Module navigation works
- UI layout complete

Please check that the modules directory exists and contains README files.
`;
      setContent(fallbackContent);
    } finally {
      setLoading(false);
    }
  }, [module]);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (loading) {
    return (
      <div className="markdown-viewer">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading module content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="markdown-viewer">
        <div className="error">
          <h3>Error Loading Content</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const addCopyButtons = (html) => {
    // Add copy buttons to code blocks
    return html.replace(
      /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
      (match, lang, code) => {
        // Clean the code content properly
        const decodedCode = code
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&#x60;/g, '`');
        
        // Create a unique ID for this code block
        const codeId = 'code-' + Math.random().toString(36).substr(2, 9);
        
        return `
          <div class="code-block-container">
            <div class="code-block-header">
              <span class="language-label">${lang}</span>
              <div class="code-actions">
                <button class="copy-button" data-code-id="${codeId}" title="Copy code">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="m5 15-2-2 2-2"></path>
                    <path d="M5 9V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Copy
                </button>
                <button class="run-button" data-code-id="${codeId}" title="Run in terminal">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="4 17 10 11 4 5"></polyline>
                    <line x1="12" y1="19" x2="20" y2="19"></line>
                  </svg>
                  Run
                </button>
              </div>
            </div>
            <pre><code id="${codeId}" class="language-${lang}">${code}</code></pre>
          </div>
        `;
      }
    );
  };


  return (
    <div className="markdown-viewer">
      <div 
        ref={containerRef}
        className="markdown-content"
        dangerouslySetInnerHTML={{ 
          __html: content
            ? DOMPurify.sanitize(
                addCopyButtons(marked(content)),
                {
                  ADD_TAGS: ['svg','path','rect','polyline','line'],
                  ADD_ATTR: ['width','height','viewBox','fill','stroke','stroke-width','x','y','rx','ry','points','d','x1','y1','x2','y2','data-code-id']
                }
              )
            : '' 
        }}
      />
    </div>
  );
}

export default MarkdownViewer;
