const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// TF.js requires react-native-fs but Expo doesn't support it well.
// We mock it to allow the bundler to finish.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-fs': require.resolve('expo-file-system'),
};

module.exports = config;
