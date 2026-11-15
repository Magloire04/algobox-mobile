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
    // Modules de l'interface : tous les fichiers de js/ sauf le moteur et les exemples (scripts classiques).
    files: ['js/**/*.js'],
    ignores: ['js/algoEngine.js', 'js/exampleLibrary.js'],
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
