/* eslint-env node */

'use strict'

const path = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
    entry: {
        background: './chrome-extension/src/background.js',
        popup: './chrome-extension/src/popup.js',
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'chrome-extension/dist')
    },
    node: {
        fs: 'empty'
    },
    devtool: 'cheap-source-map',
    module: {
        rules: [{
            test: /\.css$/,
            use: [ 'style-loader', 'css-loader' ]
        }]
    },
    optimization: {
        minimizer: [
            new UglifyJsPlugin({
                uglifyOptions: {
                    compress: {
                        unused: false // To avoid "assignment to const" error due to bad compression
                    }
                }
            })
        ]
    }
}
