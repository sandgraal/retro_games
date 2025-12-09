import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const browserConfig = {
  files: ["app/**/*.js"],
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
    sourceType: "module",
    globals: {
      ...globals.node,
    },
  },
  rules: {
    ...js.configs.recommended.rules,
    "no-redeclare": ["error", { builtinGlobals: false }],
  },
};

const typescriptConfig = {
  files: ["src/**/*.ts", "tests/**/*.ts"],
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    globals: {
      ...globals.browser,
      ...globals.node,
      HTMLElementTagNameMap: "readonly",
    },
    parser: tseslint.parser,
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
  },
  rules: {
    // Disable base no-unused-vars in favor of TS version
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
};

export default [
  {
    ignores: ["config.js", "node_modules/", "evaluation/", "covers/", "dist/"],
  },
  browserConfig,
  nodeScriptsConfig,
  typescriptConfig,
  prettier,
];
