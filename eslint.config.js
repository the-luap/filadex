// Deliberately narrow. Every rule here is either a defect TypeScript cannot see
// (the React hook rules, which is what this file is for) or a core correctness
// rule that was already clean when it was added. Nothing stylistic, no
// formatter, and no rule that would have needed a wave of disables to turn
// on: the check starts green, so every future report is a real one.
//
// Unused variables are not here on purpose: tsconfig's noUnusedLocals covers
// them, and both `npm run check` targets already run in CI.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/**", "public/**", "playwright-report/**", "test-results/**"],
  },
  js.configs.recommended,
  // Turns off the core rules TypeScript makes redundant (no-undef and the
  // like) for .ts/.tsx files, and wires up the parser. Not the "recommended"
  // rule set: that brings no-explicit-any and friends, which the codebase
  // does not pass today.
  tseslint.configs.eslintRecommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
  },
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // The core rule does not understand TypeScript signatures; it reports
      // every parameter name in an interface. noUnusedLocals is the check.
      "no-unused-vars": "off",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
      "no-debugger": "error",
    },
  },
  {
    // React lives only in the client. Scoping the hook rules there keeps
    // rules-of-hooks from flagging a server-side test helper that merely
    // starts with "use".
    files: ["client/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
);
