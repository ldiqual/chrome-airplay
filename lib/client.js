'use strict'

const Pairing = require('./pair')
const Verifier = require('./verify')
const request = require('./request')
const plist = require('plist')

class Client {
    
    constructor({ ipAddress, user, clientPrivateKey, clientPublicKey }) {
        
        this.ipAddress = ipAddress
        this.user = user
        this.clientPrivateKey = clientPrivateKey
        this.clientPublicKey = clientPublicKey
        
        this.pairing = null
    }
    
    async startPairing() {
        
        this.pairing = new Pairing({
            ipAddress: this.ipAddress,
            user: this.user,
            clientPrivateKey: this.clientPrivateKey,
            clientPublicKey: this.clientPublicKey
        })
        
        console.log('Start pairing')
        await this.pairing.start()
    }
    
    async enterPin({ pin }) {
        
        console.log('Pair 1')
        await this.pairing.step1({ user: this.user })
        
        console.log('Pair 2')
        await this.pairing.step2({ pin })
        
        console.log('Pair 3')
        await this.pairing.step3()
    }
    
    async verify() {
        const verifier = new Verifier({
            ipAddress: this.ipAddress,
            clientPrivateKey: this.clientPrivateKey,
            clientPublicKey: this.clientPublicKey
        })
        
        console.log('Verify 1')
        await verifier.step1()
        
        console.log('Verify 2')
        await verifier.step2()
    }
    
    async play({ videoUrl }) {
        console.log('Play', videoUrl)
        await request.plistRequest({
            host: this.ipAddress,
            method: 'POST',
            path: 'play',
            params: {
                'Content-Location': videoUrl,
                'Start-Position': 0
            }
        })
    }
    
    async seek(position) {
        console.log('Seek', position)
        await request.plistRequest({
            host: this.ipAddress,
            method: 'POST',
            path: 'scrub',
            qs: {
                position: position
            }
        })
    }
    
    async pause() {
        console.log('Pause')
        await request.plistRequest({
            host: this.ipAddress,
            method: 'POST',
            path: 'rate',
            qs: {
                value: 0
            }
        })
    }
    
    async resume() {
        console.log('Resume')
        await request.plistRequest({
            host: this.ipAddress,
            method: 'POST',
            path: 'rate',
            qs: {
                value: 1
            }
        })
    }
    
    async stop() {
        console.log('Stop')
        await request.plistRequest({
            host: this.ipAddress,
            method: 'POST',
            path: 'stop'
        })
    }
    
    async getPlaybackInfo() {
        console.log('Playback info')
        
        let response
        
        try {
            response = await request.httpRequest({
                host: this.ipAddress,
                method: 'GET',
                path: 'playback-info'
            })
        } catch (err) {
            return {
                duration: 1,
                position: 0,
                isPlaying: false,
            }
        }
        
        const xml = response.toString('utf8')
        const json = plist.parse(xml)
        
        return {
            duration: json.duration,
            position: json.position,
            isPlaying: json.rate === 1,
        }
    }
}

module.exports = Client
