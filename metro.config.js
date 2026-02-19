const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

module.exports = (async () => {
  const defaultConfig = await getDefaultConfig(__dirname);
  const { resolver: { sourceExts, assetExts } } = defaultConfig;
  return mergeConfig(defaultConfig, {
    transformer: {
      babelTransformerPath: require.resolve('react-native-svg-transformer'),
    },
    resolver: {
      assetExts: assetExts.filter((ext) => ext !== 'svg'),
      sourceExts: [...sourceExts, 'svg'],
    },
    // Force SVGs (and all modules) to be read from disk every time—no transform cache.
    // Prevents stale tab icons after replacing files in assets/images.
    cacheStores: [],
    cacheVersion: 'no-cache-svg',
  });
})(); 