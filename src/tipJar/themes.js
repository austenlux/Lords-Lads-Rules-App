/**
 * Tip Jar themes.
 *
 * Each theme controls the copy and (in future) the 6 button images shown
 * in the Tip Jar section. A single theme is picked randomly at module load
 * time — i.e. once per app lifecycle — and exported as `activeTipJarTheme`.
 */

export const TIP_JAR_THEMES = [
  { id: 'fire', title: 'Fuel the Forge' },
  { id: 'wood', title: "Carpenter's Coin" },
];

// Picked once when the module is first imported (app launch).
// Same theme for the entire session; a new one may be picked on next launch.
export const activeTipJarTheme =
  TIP_JAR_THEMES[Math.floor(Math.random() * TIP_JAR_THEMES.length)];
