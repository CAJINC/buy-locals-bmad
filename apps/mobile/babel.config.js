module.exports = {
  presets: ['@react-native/babel-preset'],
  plugins: [
    'nativewind/babel',
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@shared': '../../packages/shared',
          '@ui': '../../packages/ui',
        },
      },
    ],
  ],
};