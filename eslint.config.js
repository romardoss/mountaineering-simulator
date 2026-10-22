import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "assets"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // §0.2.1 / ARCHITECTURE §2.1: the engine is pure and headless.
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: ["**/game/**", "**/ui/**", "**/app/**", "**/i18n/**", "phaser", "preact", "preact/*", "@preact/*"],
      }],
      "no-restricted-globals": ["error", "window", "document", "localStorage", "performance"],
      "no-restricted-properties": ["error",
        { object: "Math", property: "random", message: "Use the seeded RNG (engine/rng)." },
        { object: "Date", property: "now", message: "The engine has no clock." },
      ],
    },
  },
);
