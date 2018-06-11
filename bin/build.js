'use strict'

const Promise = require('bluebird')
const fs = require('fs-extra')
const path = require('path')
const webpack = require('webpack')
const _ = require('lodash')
const archiver = require('archiver')

const webpackConfig = require('../webpack.config.js')

async function run() {
    const outputDir = path.join(__dirname, '..', 'build', 'chrome-extension')
    
    // Create `build/chrome-extension/` directory
    if (!await fs.pathExists(outputDir)) {
        await fs.mkdir(outputDir)
    }
    
    const sourceFilenames = [
        'images',
        'manifest.json',
        'popup.html',
    ]
    
    // Copy specific files from `chrome-extension/` to `build/chrome-extension/`
    await Promise.each(sourceFilenames, async filename => {
        const src = path.join(__dirname, '..', 'chrome-extension', filename)
        const dst = path.join(outputDir, filename)
        console.log(`${src} → ${dst}`)
        await fs.copy(src, dst)
    })
    
    // Create webpack configuration for production mode
    // JS files will be compiled to `build/chrome-extension/dist/`
    const webpackOutputDir = path.resolve(path.join(outputDir, 'dist'))
    const prodWebpackConfig = _.defaultsDeep({
        mode: 'production',
        output: {
            filename: '[name].js',
            path: webpackOutputDir
        }
    }, webpackConfig)
    
    // Create webpack instance
    const compiler = webpack(prodWebpackConfig)
    const run = Promise.promisify(compiler.run, { context: compiler })
    
    // Run webpack
    console.log(`Webpack destination: ${webpackOutputDir}`)
    await run()
    
    // Zip to `build.zip`
    const zipPath = path.join(__dirname, '..', 'build', 'build.zip')
    console.log(`Zipping to ${zipPath}`)
    await new Promise((fulfill, reject) => {
        
        const archive = archiver('zip')
        const outputStream = fs.createWriteStream(zipPath)
        archive.pipe(outputStream)
        
        archive.on('warning', err => console.warn(err))
        archive.on('error', err => reject(err))
        archive.on('end', () => fulfill())
        
        archive.directory(outputDir, false)
        archive.finalize()
    })
}

run().catch(err => {
    console.error(err.stack)
    process.exit(1)
})
