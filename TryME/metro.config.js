const { getDefaultConfig } = require('expo/metro-config');

const path = require('path');

const config = getDefaultConfig(__dirname);

// TF.js requires react-native-fs but Expo doesn't support it well.
// We mock it to allow the bundler to finish.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-fs': path.dirname(require.resolve('expo-file-system/package.json')),
};

// Add support for avif images
if (!config.resolver.assetExts.includes('avif')) {
  config.resolver.assetExts.push('avif');
}

module.exports = config;