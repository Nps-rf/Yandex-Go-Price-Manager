const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'production',
  entry: {
    injection: './script.js' // Указываем только JS файлы здесь
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
    new MiniCssExtractPlugin({
      filename: 'injection.styles.css' // Файл CSS будет создан здесь
    })
  ]
};
