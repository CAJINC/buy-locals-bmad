module.exports = {
  root: true,
  extends: ['./packages/config/eslint-base.js'],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '.next/',
    'android/',
    'ios/',
    'cdk.out/',
  ],
  overrides: [
    {
      files: ['apps/web/**/*', 'packages/ui/**/*'],
      extends: ['./packages/config/eslint-react.js'],
    },
    {
      files: ['apps/mobile/**/*'],
      extends: ['./packages/config/eslint-react-native.js'],
    },
    {
      files: ['apps/api/**/*', 'scripts/**/*', 'infrastructure/**/*'],
      extends: ['./packages/config/eslint-base.js'],
      env: {
        node: true,
      },
    },
  ],
};