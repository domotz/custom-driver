import js from "@eslint/js";
import globals from "globals";
import stylistic from "@stylistic/eslint-plugin";

// Drivers run as plain scripts inside the collector sandbox, which exposes only these globals
// (remote_pawn_ng src/sandbox/sandbox.js endowments). Anything else is undefined at runtime.
const sandboxGlobals = {
    D: "readonly",
    console: "readonly",
    setTimeout: "readonly",
    net: "readonly",
    dgram: "readonly",
};

// House style, picked from what most drivers already used: 4 spaces, semicolons, double quotes, LF.
const styleRules = {
    "@stylistic/indent": ["error", 4, { SwitchCase: 1 }],
    "@stylistic/semi": ["error", "always"],
    "@stylistic/quotes": ["error", "double", { avoidEscape: true, allowTemplateLiterals: "always" }],
    "@stylistic/linebreak-style": ["error", "unix"],
    "@stylistic/eol-last": ["error", "always"],
    "@stylistic/no-trailing-spaces": "error",
    "@stylistic/no-tabs": "error",
    "@stylistic/no-multiple-empty-lines": ["error", { max: 1, maxBOF: 0, maxEOF: 0 }],
    "@stylistic/brace-style": ["error", "1tbs", { allowSingleLine: true }],
    "@stylistic/keyword-spacing": "error",
    "@stylistic/space-before-blocks": "error",
    "@stylistic/space-before-function-paren": ["error", { anonymous: "always", named: "never", asyncArrow: "always" }],
    "@stylistic/space-in-parens": ["error", "never"],
    "@stylistic/space-infix-ops": "error",
    "@stylistic/comma-spacing": "error",
    "@stylistic/comma-dangle": ["error", "never"],
    "@stylistic/key-spacing": "error",
    "@stylistic/object-curly-spacing": ["error", "always"],
    "@stylistic/array-bracket-spacing": ["error", "never"],
    "@stylistic/semi-spacing": "error",
};

const driverConfig = {
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: "script",
        globals: sandboxGlobals,
    },
    rules: {
        ...js.configs.recommended.rules,
        ...styleRules,
        // Entry points (validate, get_status, custom_N) are called by the sandbox, not the file.
        "no-unused-vars": ["error", { vars: "local", args: "none", caughtErrors: "none" }],
        // Regex escapes are harmless and widespread; ANSI escape stripping needs control chars.
        "no-useless-escape": "off",
        "no-control-regex": "off",
    },
};

export default [
    { ignores: ["node_modules/**"] },
    { plugins: { "@stylistic": stylistic } },
    {
        files: ["**/*.js"],
        ignores: ["spec/**"],
        ...driverConfig,
    },
    // Robustness-net fixtures are tiny drivers: lint them exactly like drivers.
    { files: ["spec/net/fixtures/**/*.js"], ...driverConfig },
    {
        files: ["spec/**/*.js"],
        ignores: ["spec/net/fixtures/**"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: { ...globals.node, ...globals.jasmine },
        },
        rules: { ...js.configs.recommended.rules, ...styleRules },
    },
];
