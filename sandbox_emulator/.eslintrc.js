module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true
    },
    "plugins": [
        "es5"
    ],
    "ignorePatterns": ["dist/**", "lib/**"],
    "extends": [
        "eslint:recommended",
        "plugin:es5/no-es2015",
        "plugin:es5/no-es2016"
    ],
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "warn",
            "double"
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-unused-vars": "off",
        "no-undef": "off",
        "no-useless-escape": "off",
    }
};
