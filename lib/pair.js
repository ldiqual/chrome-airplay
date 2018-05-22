'use strict'

const crypto = require('crypto')
const srp = require('fast-srp-hap')

const request = require('./request')
const utils = require('./utils')

class InvalidPinError extends Error {}

class Pairing {
    
    constructor({ ipAddress, user, clientPrivateKey, clientPublicKey }) {
        
        utils.assertIsString(ipAddress, 'ipAddress', { minLength: 8 })
        utils.assertIsString(user, 'user', { minLength: 4 })
        utils.assertIsBuffer(clientPrivateKey, 'clientPrivateKey', { length: 32 })
        utils.assertIsBuffer(clientPublicKey, 'clientPublicKey', { length: 32 })
        
        this.ipAddress = ipAddress
        this.user = user
        this.clientPrivateKey = clientPrivateKey
        this.clientPublicKey = clientPublicKey
        
        this.srpClient = null
        this.atvPublicKey = null
        this.atvSalt = null
    }
    
    async start() {
        await request.plistRequest({
            host: this.ipAddress,
            method: 'POST',
            path: 'pair-pin-start',
            params: {}
        })
    }
    
    async step1() {
        
        const result = await request.plistRequest({
            host: this.ipAddress,
            method: 'POST',
            path: 'pair-setup-pin',
            params: {
                user: this.user,
                method: 'pin'
            }
        })
        
        const { pk, salt } = result[0]
        utils.assertIsBuffer(pk, 'pk', { length: 256 })
        utils.assertIsBuffer(salt, 'salt', { length: 16 })
        
        this.atvPublicKey = pk
        this.atvSalt = salt
    }
    
    async step2({ pin }) {
        
        // Params
        utils.assertIsString(pin, 'pin', { length: 4 })
        
        // State
        utils.assertIsBuffer(this.atvPublicKey, 'atvPublicKey', { length: 256 })
        utils.assertIsBuffer(this.atvSalt, 'atvSalt', { length: 16 })
        
        this.srpClient = getSrpClient({
            user: this.user,
            pin,
            clientPrivateKey: this.clientPrivateKey,
            atvPublicKey: this.atvPublicKey,
            atvSalt: this.atvSalt
        })
        
        await request.plistRequest({
            host: this.ipAddress,
            method: 'POST',
            path: 'pair-setup-pin',
            params: {
                pk: this.srpClient.computeA(),
                proof: this.srpClient.computeM1()
            }
        }).catch(err => {
            if (err.response && err.response.status) {
                throw new InvalidPinError('Invalid pin')
            }
            throw err
        })
    }
    
    async step3() {
        
        // State
        utils.assertIsNotNull(this.srpClient, 'srpClient')
        utils.assertIsBuffer(this.clientPublicKey, 'clientPublicKey', { length: 32 })
        
        const sharedSecretHash = this.srpClient.computeK()
        const aesKey = crypto.createHash('sha512').update('Pair-Setup-AES-Key').update(sharedSecretHash).digest().slice(0, 16)
        const aesIV = crypto.createHash('sha512').update('Pair-Setup-AES-IV').update(sharedSecretHash).digest().slice(0, 16)
        aesIV[15]++

        const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, aesIV)
        const epk = cipher.update(this.clientPublicKey)
        cipher.final()
        const authTag = cipher.getAuthTag()
        
        await request.plistRequest({
            host: this.ipAddress,
            method: 'POST',
            path: 'pair-setup-pin',
            params: { epk, authTag }
        })
    }
}

Pairing.InvalidPinError = InvalidPinError

function getSrpClient({ user, pin, clientPrivateKey, atvPublicKey, atvSalt }) {
    
    // Params
    utils.assertIsString(user, 'user', { minLength: 4 })
    utils.assertIsString(pin, 'pin', { length: 4 })
    utils.assertIsBuffer(clientPrivateKey, 'clientPrivateKey', { length: 32 })
    utils.assertIsBuffer(atvPublicKey, 'atvPublicKey', { length: 256 })
    utils.assertIsBuffer(atvSalt, 'atvSalt', { length: 16 })
    
    const srpParams = srp.params[2048]
    srpParams.hash = 'sha1'
    
    const client = new srp.Client(
        srpParams,
        atvSalt,
        Buffer.from(user, 'utf8'),
        Buffer.from(pin, 'utf8'),
        clientPrivateKey
    )
    client.setB(atvPublicKey)
    
    return client
}

module.exports = Pairing
