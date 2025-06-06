const path = require('path');
const WebpackObfuscator = require('webpack-obfuscator');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

module.exports = {
    mode: 'production',
    entry: {
        main: './src/index.js',
        injection: './src/injection/index.js'
    },
    target: 'electron-main',
    devtool: 'source-map',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js'
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'], // Обработка CSS
            },
        ],
    },
    plugins: [
        new WebpackObfuscator({
            rotateStringArray: true,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.3,
            numbersToExpressions: true,
            identifierNamesGenerator: 'hexadecimal',
            stringArray: true,
            seed: new Date().getTime()
        }),
        new MiniCssExtractPlugin({
            filename: 'injection.styles.css'
        }),
        new webpack.EnvironmentPlugin({
            'NODE_ENV': 'production'
        })
    ]
};
