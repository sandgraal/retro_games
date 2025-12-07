const js = require("@eslint/js");
const globals = require("globals");
const prettier = require("eslint-config-prettier");

const browserConfig = {
  files: ["app.js", "app/**/*.js"],
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    globals: {
      ...globals.browser,
    },
  },
  rules: {
    ...js.configs.recommended.rules,
  },
};

const nodeScriptsConfig = {
  files: ["scripts/**/*.js"],
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "script",
    globals: {
      ...globals.node,
    },
  },
  rules: {
    ...js.configs.recommended.rules,
    "no-redeclare": ["error", { builtinGlobals: false }],
  },
};

module.exports = [
  {
    ignores: ["config.js", "node_modules/", "evaluation/", "covers/"],
  },
  browserConfig,
  nodeScriptsConfig,
  prettier,
];
