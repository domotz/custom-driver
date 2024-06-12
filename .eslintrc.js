module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2021: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 6
  },
  globals: {
    D: 'readonly'
  },
  rules: {
    'no-unused-vars': ['error', { varsIgnorePattern: '^get_status|validate$' }]
  }
}
