'use strict'

const Promise = require('bluebird')
const nacl = require('tweetnacl')
const Errio = require('errio')

const Client = require('../../lib/client')
const request = require('../../lib/request')

chrome.runtime.onInstalled.addListener(function() {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        
        const rule = {
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: {
                        hostEquals: 'www.youtube.com',
                        pathEquals: '/watch'  
                    }
                })
            ],
            actions: [ new chrome.declarativeContent.ShowPageAction() ]
        }
        
        chrome.declarativeContent.onPageChanged.addRules([ rule ])
    })
})

function createCredentials() {
    const user = 'chrome-airplay'
    const keyPair = nacl.sign.keyPair()
    const clientPrivateKey = Buffer.from(keyPair.secretKey.slice(0, 32))
    const clientPublicKey = Buffer.from(keyPair.publicKey)
    return { user, clientPrivateKey, clientPublicKey }
}

function saveCredentials({ user, clientPrivateKey, clientPublicKey }) {
    const clientPrivateKeyBase64 = clientPrivateKey.toString('base64')
    const clientPublicKeyBase64 = clientPublicKey.toString('base64')
    const json = JSON.stringify({
        user,
        clientPrivateKey: clientPrivateKeyBase64,
        clientPublicKey: clientPublicKeyBase64
    })
    window.localStorage.setItem('credentials', json)
}

function removeCredentials() {
    window.localStorage.removeItem('credentials')
}

function getSavedCredentials() {
    
    const credentialsJSON = window.localStorage.getItem('credentials')
    if (!credentialsJSON) {
        return null
    }
    
    const credentials = JSON.parse(credentialsJSON)
    
    const {
        user,
        clientPrivateKey: clientPrivateKeyBase64,
        clientPublicKey: clientPublicKeyBase64
    } = credentials
    
    if (!user || !clientPrivateKeyBase64 || !clientPublicKeyBase64) {
        return null
    }
    
    const clientPrivateKey = Buffer.from(clientPrivateKeyBase64, 'base64')
    const clientPublicKey = Buffer.from(clientPublicKeyBase64, 'base64')
    
    return { user, clientPrivateKey, clientPublicKey }
}

function getNewAirplayInstance({ ipAddress }) {
    let credentials = getSavedCredentials()
    if (!credentials) {
        credentials = createCredentials()
        saveCredentials(credentials)
    }
    return new Client({ ipAddress, ...credentials })
}

function getSavedIpAddress() {
    return window.localStorage.getItem('ipAddress') || null
}

function saveIpAddress(ipAddress) {
    return window.localStorage.setItem('ipAddress', ipAddress)
}

function removeIpAddress() {
    window.localStorage.removeItem('ipAddress')
}

let airplay = null
const savedIpAddress = getSavedIpAddress()
if (savedIpAddress !== null) {
    airplay = getNewAirplayInstance({ ipAddress: savedIpAddress })
}

async function testConnection({ ipAddress }) {
    const getInfo = request.httpRequest({
        host: ipAddress,
        method: 'GET',
        path: 'info'
    })
    const timeoutError = new Error("Couldn't connect to this Apple TV, please try a different address")
    const timeout = Promise.delay(1000).then(() => Promise.reject(timeoutError))
    await Promise.race([ getInfo, timeout ])
}

const handlers = {
    'pairing.hasIpAddress': async(req) => {
        const hasIpAddress = getSavedIpAddress() !== null
        return { hasIpAddress }
    },
    'pairing.setIpAddress': async(req) => {
        const ipAddress = req.ipAddress
        await testConnection({ ipAddress })
        saveIpAddress(ipAddress)
        airplay = getNewAirplayInstance({ ipAddress })
        return {}
    },
    'pairing.start': async(req) => {
        await airplay.startPairing()
        return {}
    },
    'pairing.enterPin': async(req) => {
        const pin = req.pin
        await airplay.enterPin({ pin })
        return {}
    },
    'verify': async(req) => {
        const timeoutError = new Error("Couldn't connect to this Apple TV, please try a different address")
        const timeout = Promise.delay(1000).then(() => Promise.reject(timeoutError))
        return Promise.race([ airplay.verify(), timeout ]).then(() => {
            return {}
        })
    },
    'playback.play': async(req) => {
        const { videoUrl } = req
        await airplay.play({ videoUrl })
        return {}
    },
    'playback.info': async(req) => {
        const playbackInfo = await airplay.getPlaybackInfo()
        return { playbackInfo }
    },
    'playback.seek': async(req) => {
        const { position } = req
        await airplay.seek(position)
        return {}
    },
    'playback.pause': async(req) => {
        await airplay.pause()
        return {}
    },
    'playback.resume': async(req) => {
        await airplay.resume()
        return {}
    },
    'playback.stop': async(req) => {
        await airplay.stop()
        return {}
    },
    'unpair': async(req) => {
        await airplay.stop()
        removeIpAddress()
        removeCredentials()
        airplay = null
        return {}
    }
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    
    const action = req.action
    if (!action) {
        console.error('No action in message payload', req)
        return
    }
    
    const handler = handlers[req.action]
    if (!handler) {
        console.error(`No handler for action ${action}`, req)
        return
    }
    
    console.log(`Got message for action ${action}`, req)
    
    Promise.try(async() => {
        const response = await handler(req)
        console.log(`Response for ${action}`, response)
        sendResponse(response)
    }).catch(err => {
        console.error(`Error for ${action}`, err)
        sendResponse({ error: Errio.toObject(err) })
    })
    
    return true
})
