import React from 'react';
import '../styles/ModuleNavigator.css';

function ModuleNavigator({ modules, currentModule, onModuleChange }) {
  const formatModuleName = (moduleName) => {
    // Convert "01-foundation" to "01: Foundation"
    const [number, ...nameParts] = moduleName.split('-');
    const name = nameParts.join(' ').replace(/\b\w/g, l => l.toUpperCase());
    return `${number}: ${name}`;
  };

  return (
    <div className="module-navigator">
      <select
        value={currentModule}
        onChange={(e) => onModuleChange(e.target.value)}
        className="module-select"
      >
        {modules.map(module => (
          <option key={module.name} value={module.name}>
            {formatModuleName(module.name)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ModuleNavigator;
