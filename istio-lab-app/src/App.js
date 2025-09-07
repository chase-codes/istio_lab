import React, { useState, useEffect, useCallback } from 'react';
import MarkdownViewer from './components/MarkdownViewer';
import ModuleNavigator from './components/ModuleNavigator';
import Terminal from './components/Terminal';
import './styles/App.css';

function App() {
  const [currentModule, setCurrentModule] = useState('');
  const [modules, setModules] = useState([]);
  const [splitPosition, setSplitPosition] = useState(50);

  const loadModules = useCallback(async () => {
    try {
      let modulesToSet = [];
      
      if (window.electronAPI) {
        // Try to load real modules
        const modulesPath = await window.electronAPI.getModulesPath();
        const items = await window.electronAPI.listDirectory(modulesPath);

        const moduleDirs = items
          .filter(item => item.isDirectory && item.name.match(/^\d+-/))
          .sort((a, b) => a.name.localeCompare(b.name));

        modulesToSet = moduleDirs;
      } else {
        // Fallback to mock modules
        modulesToSet = [
          { name: '01-foundation', isDirectory: true },
          { name: '02-service-mesh-value', isDirectory: true },
          { name: '03-sidecar-vs-ambient', isDirectory: true },
          { name: '04-identity-security', isDirectory: true },
          { name: '05-traffic-management', isDirectory: true },
          { name: '06-observability', isDirectory: true },
          { name: '07-multi-cluster', isDirectory: true },
          { name: '08-integration', isDirectory: true }
        ];
      }

      setModules(modulesToSet);

      // Set first module as current if none selected and modules exist
      if (modulesToSet.length > 0) {
        setCurrentModule(prev => prev || modulesToSet[0].name);
      }
    } catch (error) {
      console.error('Failed to load modules:', error);
      // Use fallback modules on error
      const fallbackModules = [
        { name: '01-foundation', isDirectory: true },
        { name: '02-service-mesh-value', isDirectory: true }
      ];
      setModules(fallbackModules);
      setCurrentModule(prev => prev || fallbackModules[0].name);
    }
  }, []);

  useEffect(() => {
    // Load available modules
    loadModules();
  }, [loadModules]);

  const handleModuleChange = (moduleName) => {
    setCurrentModule(moduleName);
  };

  return (
    <div className="app">
      <div className="header">
        <h1>Istio PM Mastery Lab</h1>
        <ModuleNavigator
          modules={modules}
          currentModule={currentModule}
          onModuleChange={handleModuleChange}
        />
      </div>

      <div className="main-content">
        <div className="split-pane">
          <div className="pane markdown-pane" style={{ width: `${splitPosition}%` }}>
            <MarkdownViewer module={currentModule} />
          </div>
          <div className="split-handle" />
          <div className="pane terminal-pane" style={{ width: `${100 - splitPosition}%` }}>
            <Terminal module={currentModule} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
