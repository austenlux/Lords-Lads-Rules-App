import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lnl_theme';
const FONT_STORAGE_KEY = '@lnl_font';
const DEFAULT_THEME_ID = 'hammer-steel';

export const COLOR_GROUPS = [
  {
    id: 'forge',
    label: 'The Forge',
    options: [
      { id: 'hammer-steel',      label: 'Hammer Steel',      color: '#7B8C9E' },
      { id: 'forged-iron',       label: 'Forged Iron',       color: '#7A7A7A' },
      { id: 'oxidized-copper',   label: 'Oxidized Copper',   color: '#4A707A' },
      { id: 'glowing-embers',    label: 'Glowing Embers',    color: '#C6442E' },
    ],
  },
  {
    id: 'timber',
    label: 'The Timber',
    options: [
      { id: 'weathered-oak',     label: 'Weathered Oak',     color: '#968D81' },
      { id: 'burnt-sienna',      label: 'Burnt Sienna',      color: '#A0522D' },
      { id: 'fresh-cedar',       label: 'Fresh Cedar',       color: '#C19A6B' },
      { id: 'aged-mahogany',     label: 'Aged Mahogany',     color: '#7B3F32' },
    ],
  },
  {
    id: 'wilds',
    label: 'The Wilds',
    options: [
      { id: 'forest-pine',       label: 'Forest Pine',       color: '#4A8A5B' },
      { id: 'meadow-moss',       label: 'Meadow Moss',       color: '#8A9A5B' },
      { id: 'wild-heather',      label: 'Wild Heather',      color: '#8D5B8D' },
      { id: 'oxblood',            label: 'Oxblood',            color: '#7D2D2D' },
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
      { id: 'amber-ale',         label: 'Amber Ale',         color: '#D18D00' },
      { id: 'frothy-head',       label: 'Frothy Head',       color: '#F5F5DC' },
      { id: 'toasted-malt',      label: 'Toasted Malt',      color: '#D2B48C' },
    ],
  },
  {
    id: 'aurora',
    label: 'The Aurora',
    options: [
      { id: 'electric-lime',     label: 'Electric Lime',     color: '#B4D926' },
      { id: 'borealis-green',    label: 'Borealis Green',    color: '#42D930' },
      { id: 'twilight-violet',   label: 'Twilight Violet',   color: '#BB86FC' },
      { id: 'crimson-horizon',   label: 'Crimson Horizon',   color: '#D93070' },
    ],
  },
];

export const THEME_OPTIONS = COLOR_GROUPS.flatMap(g => g.options);

const THEME_MAP = Object.fromEntries(
  COLOR_GROUPS.flatMap(g => g.options).map(t => [t.id, t.color]),
);

const font = (ios, android) => Platform.select({ ios, android });

const DEFAULT_FONT_ID = 'blacksmiths-ledger';

export const FONT_PAIRINGS = [
  {
    id: 'blacksmiths-ledger',
    name: "The Blacksmith's Ledger",
    titleFont: font('MedievalSharp', 'MedievalSharp'),
    descFont:  font('Roboto Mono', 'RobotoMono'),
    titlePreview: 'Hammer & Anvil',
    descPreview:  'Technical specification VII-A',
  },
  {
    id: 'lumberjacks-field-guide',
    name: "Lumberjack's Field Guide",
    titleFont: font('Alfa Slab One', 'AlfaSlabOne'),
    descFont:  font('Public Sans', 'PublicSans'),
    titlePreview: 'Tall Timber',
    descPreview:  'Exploring the northern wilderness.',
  },
];

const FONT_MAP = Object.fromEntries(FONT_PAIRINGS.map(f => [f.id, f]));

function hexToGlow(hex, alpha = 0.3) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [fontId, setFontId] = useState(DEFAULT_FONT_ID);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(FONT_STORAGE_KEY),
    ]).then(([storedTheme, storedFont]) => {
      if (storedTheme && THEME_MAP[storedTheme]) setThemeId(storedTheme);
      if (storedFont && FONT_MAP[storedFont]) setFontId(storedFont);
    });
  }, []);

  const selectTheme = async (id) => {
    if (!THEME_MAP[id]) return;
    setThemeId(id);
    await AsyncStorage.setItem(STORAGE_KEY, id);
  };

  const selectFont = async (id) => {
    if (!FONT_MAP[id]) return;
    setFontId(id);
    await AsyncStorage.setItem(FONT_STORAGE_KEY, id);
  };

  const value = useMemo(() => {
    const accent = THEME_MAP[themeId];
    return {
      themeId,
      accent,
      accentGlow: hexToGlow(accent, 0.3),
      selectTheme,
      fontId,
      selectFont,
    };
  }, [themeId, fontId]);

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
