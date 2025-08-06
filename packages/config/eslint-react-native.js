module.exports = {
  extends: [
    './eslint-react.js',
    'plugin:react-native/all',
  ],
  plugins: ['react-native'],
  rules: {
    // React Native specific rules
    'react-native/no-unused-styles': 'error',
    'react-native/split-platform-components': 'error',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-color-literals': 'warn',
    'react-native/no-raw-text': 'off', // Allow raw text in some cases
    'react-native/sort-styles': 'warn',
  },
  env: {
    'react-native/react-native': true,
  },
};