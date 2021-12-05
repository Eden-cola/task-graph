const HtmlWebpackPlugin = require('html-webpack-plugin');

/**
 * @type {import('webpack').WebpackOptionsNormalized}
 */
module.exports = {
	mode: 'development',
	entry: './examples/index.js',
	module: {
		rules: [
			{ test: /\.ts$/, use: 'ts-loader' }
		],
	},
	resolve: {
		extensions: ['.js', '.json', '.ts', '.tsx', '.wasm', '.mjs'],
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: './examples/index.html'
		})
	]
}