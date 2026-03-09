import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lnl_theme';
const DEFAULT_THEME_ID = 'purple';

export const COLOR_GROUPS = [
  {
    id: 'forge',
    label: 'The Forge',
    options: [
      { id: 'purple', label: 'Purple', color: '#BB86FC' },
      { id: 'red',    label: 'Red',    color: '#EF5350' },
      { id: 'orange', label: 'Orange', color: '#FFA726' },
      { id: 'pink',   label: 'Pink',   color: '#F48FB1' },
    ],
  },
  {
    id: 'timber',
    label: 'The Timber',
    options: [
      { id: 'brown',  label: 'Brown',  color: '#A1887F' },
      { id: 'teal',   label: 'Teal',   color: '#4DB6AC' },
      { id: 'green',  label: 'Green',  color: '#66BB6A' },
      { id: 'blue',   label: 'Blue',   color: '#64B5F6' },
    ],
  },
  {
    id: 'wilds',
    label: 'The Wilds',
    options: [
      { id: 'green',  label: 'Green',  color: '#66BB6A' },
      { id: 'teal',   label: 'Teal',   color: '#4DB6AC' },
      { id: 'brown',  label: 'Brown',  color: '#A1887F' },
      { id: 'orange', label: 'Orange', color: '#FFA726' },
    ],
  },
  {
    id: 'elements',
    label: 'The Elements',
    options: [
      { id: 'blue',   label: 'Blue',   color: '#64B5F6' },
      { id: 'red',    label: 'Red',    color: '#EF5350' },
      { id: 'purple', label: 'Purple', color: '#BB86FC' },
      { id: 'teal',   label: 'Teal',   color: '#4DB6AC' },
    ],
  },
  {
    id: 'brew',
    label: 'The Brew',
    options: [
      { id: 'pink',   label: 'Pink',   color: '#F48FB1' },
      { id: 'purple', label: 'Purple', color: '#BB86FC' },
      { id: 'orange', label: 'Orange', color: '#FFA726' },
      { id: 'red',    label: 'Red',    color: '#EF5350' },
    ],
  },
];

export const THEME_OPTIONS = COLOR_GROUPS.flatMap(g => g.options);

const THEME_MAP = Object.fromEntries(
  COLOR_GROUPS.flatMap(g => g.options).map(t => [t.id, t.color]),
);

function hexToGlow(hex, alpha = 0.3) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (stored && THEME_MAP[stored]) setThemeId(stored);
    });
  }, []);

  const selectTheme = async (id) => {
    if (!THEME_MAP[id]) return;
    setThemeId(id);
    await AsyncStorage.setItem(STORAGE_KEY, id);
  };

  const value = useMemo(() => {
    const accent = THEME_MAP[themeId];
    return {
      themeId,
      accent,
      accentGlow: hexToGlow(accent, 0.3),
      selectTheme,
    };
  }, [themeId]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
