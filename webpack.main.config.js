const {resolve} = require("path");

const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

module.exports = {
    /**
     * This is the main entry point for your application, it's the first file
     * that runs in the main process.
     */
    plugins: [
        new NodePolyfillPlugin()
    ],
    entry: './src/main.js', // Ваша главная точка входа
    output: {
        path: resolve(__dirname, 'dist'),
        filename: 'bundle.js', // Итоговый бандл с вашим кодом
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
            },
        ],
    },
    target: 'electron-main',
    resolve: {
        alias: {
            '~': resolve(__dirname, 'src'),
        }
    }
};
