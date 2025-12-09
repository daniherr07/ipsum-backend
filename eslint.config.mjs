import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
  },

  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "commonjs" },
  },

  // 👇 CONFIGURACIÓN PARA TESTS (JEST)
  {
    files: ["tests/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.jest, // añade: jest, describe, it, expect, beforeEach, afterEach...
      },
    },
  },
]);
