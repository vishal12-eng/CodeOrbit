import { useState, useEffect, useCallback } from 'react';

export interface Settings {
  appearance: {
    theme: 'light' | 'dark' | 'system';
    accentColor: string;
    fontFamily: string;
    uiDensity: 'comfortable' | 'compact';
  };
  editor: {
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
    lineNumbers: boolean;
    minimap: boolean;
    autoComplete: boolean;
    bracketMatching: boolean;
    formatOnSave: boolean;
  };
  autoSave: {
    enabled: boolean;
    delay: number;
    onFocusLoss: boolean;
  };
  languageExecution: {
    defaultLanguage: string;
    defaultTimeout: number;
    enabledRunners: {
      nodejs: boolean;
      python: boolean;
      react: boolean;
      nextjs: boolean;
      static: boolean;
    };
  };
  ai: {
    defaultModel: string;
    contextMode: 'current-file' | 'project-wide';
    enabled: boolean;
  };
}

const defaultSettings: Settings = {
  appearance: {
    theme: 'dark',
    accentColor: 'blue',
    fontFamily: 'Inter',
    uiDensity: 'comfortable',
  },
  editor: {
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    lineNumbers: true,
    minimap: true,
    autoComplete: true,
    bracketMatching: true,
    formatOnSave: true,
  },
  autoSave: {
    enabled: true,
    delay: 3,
    onFocusLoss: true,
  },
  languageExecution: {
    defaultLanguage: 'node-js',
    defaultTimeout: 30,
    enabledRunners: {
      nodejs: true,
      python: true,
      react: true,
      nextjs: true,
      static: true,
    },
  },
  ai: {
    defaultModel: 'gpt-4o',
    contextMode: 'current-file',
    enabled: true,
  },
};

const STORAGE_KEY = 'novacode-settings';

function loadSettings(): Settings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...defaultSettings,
        ...parsed,
        appearance: { ...defaultSettings.appearance, ...parsed.appearance },
        editor: { ...defaultSettings.editor, ...parsed.editor },
        autoSave: { ...defaultSettings.autoSave, ...parsed.autoSave },
        languageExecution: { 
          ...defaultSettings.languageExecution, 
          ...parsed.languageExecution,
          enabledRunners: {
            ...defaultSettings.languageExecution.enabledRunners,
            ...parsed.languageExecution?.enabledRunners,
          },
        },
        ai: { ...defaultSettings.ai, ...parsed.ai },
      };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  
  return defaultSettings;
}

function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback(<K extends keyof Settings>(
    category: K,
    updates: Partial<Settings[K]>
  ) => {
    setSettingsState(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...updates,
      },
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState(defaultSettings);
  }, []);

  const resetCategory = useCallback(<K extends keyof Settings>(category: K) => {
    setSettingsState(prev => ({
      ...prev,
      [category]: defaultSettings[category],
    }));
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
    resetCategory,
    defaultSettings,
  };
}

export { defaultSettings };
