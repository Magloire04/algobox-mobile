'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Règles de sécurité en erreur bloquante. Le seul écart autorisé est l'exécution de
      // l'algorithme de l'utilisateur (voir docs/decisions.md), signalé ligne par ligne.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: [
      'js/app.js',
      'js/commandPalette.js',
      'js/domHelpers.js',
      'js/exporters.js',
      'js/fileStorage.js',
      'js/helpContent.js',
      'js/instructionDialogs.js',
      'js/testWindow.js',
      'js/textEditor.js',
      'js/treeView.js',
    ],
    languageOptions: {
      sourceType: 'module',
      globals: { AlgoEngine: 'readonly', AlgoExamples: 'readonly' },
    },
  },
  {
    files: ['serviceWorker.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
];
