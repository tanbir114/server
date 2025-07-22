import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs"
    }
  },
  {
    files: ["server/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
        process: "readonly" // ✅ explicitly define `process`
      }
    }
  },
  {
    files: ["client/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.browser
    }
  }
]);
