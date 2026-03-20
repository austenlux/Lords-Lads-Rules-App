/**
 * Tip Jar themes.
 *
 * Each theme controls the copy and (in future) the 6 button images shown
 * in the Tip Jar section. A single theme is picked randomly at module load
 * time — i.e. once per app lifecycle — and exported as `activeTipJarTheme`.
 */

export const TIP_JAR_THEMES = [
  {
    id: 'fire',
    title: 'Forge Fuel',
    images: [
      require('../../assets/tipjar/fire/fire1.png'),
      require('../../assets/tipjar/fire/fire2.png'),
      require('../../assets/tipjar/fire/fire3.png'),
      require('../../assets/tipjar/fire/fire4.png'),
      require('../../assets/tipjar/fire/fire5.png'),
      require('../../assets/tipjar/fire/fire6.png'),
    ],
  },
  {
    id: 'wood',
    title: "Carpenter's Coin",
    images: [
      require('../../assets/tipjar/wood/wood1.png'),
      require('../../assets/tipjar/wood/wood2.png'),
      require('../../assets/tipjar/wood/wood3.png'),
      require('../../assets/tipjar/wood/wood4.png'),
      require('../../assets/tipjar/wood/wood5.png'),
      require('../../assets/tipjar/wood/wood6.png'),
    ],
  },
  {
    id: 'hammer',
    title: "Hammer's Hoard",
    images: [
      require('../../assets/tipjar/hammer/hammer1.png'),
      require('../../assets/tipjar/hammer/hammer2.png'),
      require('../../assets/tipjar/hammer/hammer3.png'),
      require('../../assets/tipjar/hammer/hammer4.png'),
      require('../../assets/tipjar/hammer/hammer5.png'),
      require('../../assets/tipjar/hammer/hammer6.png'),
    ],
  },
];

// Picked once when the module is first imported (app launch).
// Same theme for the entire session; a new one may be picked on next launch.
export const activeTipJarTheme =
  TIP_JAR_THEMES[Math.floor(Math.random() * TIP_JAR_THEMES.length)];
