module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: false,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 8,
    sourceType: 'module',
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
    },
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['*.d.ts', '*.js'],
  rules: {
    'no-constant-condition': ['off'],
    '@typescript-eslint/no-floating-promises': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_.',
        varsIgnorePattern: '^_.',
        caughtErrorsIgnorePattern: '^_.',
      },
    ],
    'no-constant-condition': 'off', // while(true) is fine for a lot of scripts
    '@typescript-eslint/no-inferrable-types': 'off', // consistency is better than less boilerplate
  },
}
