/* eslint-env node */

'use strict'

const Promise = require('bluebird')
const nacl = require('tweetnacl')
const inquirer = require('inquirer')

const Client = require('../lib/client')

async function promptForPin() {
    const { pin } = await inquirer.prompt({
        type: 'input',
        name: 'pin',
        message: 'Enter the PIN showing on your Apple TV'
    })
    return pin
}

async function run() {
    
    const ipAddress = '192.168.86.30'
    const user = 'chrome-airplay'
    const keyPair = nacl.sign.keyPair()
    const clientPrivateKey = Buffer.from(keyPair.secretKey.slice(0, 32))
    const clientPublicKey = Buffer.from(keyPair.publicKey)
    
    const airplay = new Client({ ipAddress, user, clientPrivateKey, clientPublicKey })
    
    await airplay.startPairing()
    
    const pin = await promptForPin()
    await airplay.enterPin({ pin })
    
    await airplay.verify()
    
    const videoUrl = 'https://media.w3.org/2010/05/sintel/trailer.mp4'
    await airplay.play({ videoUrl })
    
    await Promise.delay(10000)
}

run({ promptForPin }).catch(err => {
    console.error(err)
    process.exit(1)
})
