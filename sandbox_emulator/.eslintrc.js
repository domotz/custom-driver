module.exports = {
	'env': {
		'browser': true,
		'commonjs': true,
		'es6': true
	},
	'plugins': [
		'es5'
	],
	'ignorePatterns': ['dist/**'],
	'extends': [
		'eslint:recommended',
		'plugin:es5/no-es2015',
		'plugin:es5/no-es2016'
	],
	'parserOptions': {
		'ecmaVersion': 'latest'
	},
	'rules': {
		'indent': [
			'error',
			'tab'
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		'quotes': [
			'warn',
			'single'
		],
		'semi': [
			'error',
			'always'
		],
		'no-unused-vars': 'off',
		'no-undef': 'off',
		'no-useless-escape': 'off',
	}
};
