import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lnl_theme';
const DEFAULT_THEME_ID = 'hammer-steel';

export const COLOR_GROUPS = [
  {
    id: 'forge',
    label: 'The Forge',
    options: [
      { id: 'hammer-steel',      label: 'Hammer Steel',      color: '#7B8C9E' },
      { id: 'forged-iron',       label: 'Forged Iron',       color: '#7A7A7A' },
      { id: 'oxidized-copper',   label: 'Oxidized Copper',   color: '#4A707A' },
      { id: 'blasted-granite',   label: 'Blasted Granite',   color: '#5C5C5C' },
    ],
  },
  {
    id: 'timber',
    label: 'The Timber',
    options: [
      { id: 'weathered-oak',     label: 'Weathered Oak',     color: '#968D81' },
      { id: 'burnt-sienna',      label: 'Burnt Sienna',      color: '#8B4513' },
      { id: 'fresh-cedar',       label: 'Fresh Cedar',       color: '#C19A6B' },
      { id: 'aged-mahogany',     label: 'Aged Mahogany',     color: '#8D4B3D' },
    ],
  },
  {
    id: 'wilds',
    label: 'The Wilds',
    options: [
      { id: 'forest-pine',       label: 'Forest Pine',       color: '#3E5F4A' },
      { id: 'meadow-moss',       label: 'Meadow Moss',       color: '#8A9A5B' },
      { id: 'rusty-spike',       label: 'Rusty Spike',       color: '#A0522D' },
      { id: 'blood-orange',      label: 'Blood Orange',      color: '#CC5500' },
    ],
  },
  {
    id: 'elements',
    label: 'The Elements',
    options: [
      { id: 'sky-blue',          label: 'Sky Blue',          color: '#87CEEB' },
      { id: 'river-stone',       label: 'River Stone',       color: '#A9BA9D' },
      { id: 'glacial-ice',       label: 'Glacial Ice',       color: '#D1EAF0' },
      { id: 'morning-mist',      label: 'Morning Mist',      color: '#B7C9D3' },
    ],
  },
  {
    id: 'brew',
    label: 'The Brew',
    options: [
      { id: 'golden-lager',      label: 'Golden Lager',      color: '#FFD700' },
      { id: 'amber-ale',         label: 'Amber Ale',         color: '#FFBF00' },
      { id: 'frothy-head',       label: 'Frothy Head',       color: '#F5F5DC' },
      { id: 'toasted-malt',      label: 'Toasted Malt',      color: '#D2B48C' },
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
