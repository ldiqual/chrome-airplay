'use strict'

const crypto = require('crypto')
const nacl = require('tweetnacl')

const request = require('./request')
const utils = require('./utils')

class Verifier {
    
    constructor({ ipAddress, clientPrivateKey, clientPublicKey }) {
        
        // Params
        utils.assertIsString(ipAddress, 'ipAddress', { minLength: 8 })
        utils.assertIsBuffer(clientPrivateKey, 'clientPrivateKey', { length: 32 })
        utils.assertIsBuffer(clientPublicKey, 'clientPublicKey', { length: 32 })
        
        this.ipAddress = ipAddress
        this.clientPrivateKey = clientPrivateKey
        this.clientPublicKey = clientPublicKey
        
        this.clientVerifyPrivate = null
        this.clientVerifyPublic = null
        this.atvVerifyPublic = null
        this.atvVerifyTail = null
    }
    
    async step1() {
        
        const verifyKeyPair = nacl.box.keyPair.fromSecretKey(this.clientPrivateKey)
        const verifyPrivate = Buffer.from(verifyKeyPair.secretKey)
        const verifyPublic = Buffer.from(verifyKeyPair.publicKey)

        const data = Buffer.concat([Buffer.from([1, 0, 0, 0]), verifyPublic, this.clientPublicKey])
        
        const response = await request.httpRequest({
            host: this.ipAddress,
            method: 'POST',
            path: 'pair-verify',
            contentType: 'application/octet-stream',
            data: data
        })
        
        const pk = response.slice(0, 32)
        const tail = response.slice(32)
        
        utils.assertIsBuffer(verifyPrivate, 'verifyPrivate', { length: 32 })
        utils.assertIsBuffer(verifyPublic, 'verifyPublic', { length: 32 })
        utils.assertIsBuffer(pk, 'pk', { length: 32 })
        utils.assertIsBuffer(tail, 'tail', { minLength: 8 })
        
        this.clientVerifyPrivate = verifyPrivate
        this.clientVerifyPublic = verifyPublic
        this.atvVerifyPublic = pk
        this.atvVerifyTail = tail
    }
    
    async step2() {
        
        // State
        utils.assertIsBuffer(this.clientPrivateKey, 'clientPrivateKey', { length: 32 })
        utils.assertIsBuffer(this.clientVerifyPrivate, 'clientVerifyPrivate', { length: 32 })
        utils.assertIsBuffer(this.clientVerifyPublic, 'clientVerifyPublic', { length: 32 })
        utils.assertIsBuffer(this.atvVerifyPublic, 'atvVerifyPublic', { length: 32 })
        utils.assertIsBuffer(this.atvVerifyTail, 'atvVerifyTail', { minLength: 8 })
        
        const shared = Buffer.from(nacl.scalarMult(this.clientVerifyPrivate, this.atvVerifyPublic))
        
        const aesKey = crypto.createHash('sha512').update('Pair-Verify-AES-Key').update(shared).digest().slice(0, 16)
        const aesIV = crypto.createHash('sha512').update('Pair-Verify-AES-IV').update(shared).digest().slice(0, 16)

        const keyPair = nacl.sign.keyPair.fromSeed(this.clientPrivateKey)
        const key = Buffer.from(keyPair.secretKey)
        const signed = nacl.sign(Buffer.concat([this.clientVerifyPublic, this.atvVerifyPublic]), key)
        const signedStripped = Buffer.from(signed).slice(0, 64)
        
        const cipher = crypto.createCipheriv('aes-128-ctr', aesKey, aesIV)
        cipher.update(this.atvVerifyTail)
        const signature = cipher.update(signedStripped)
        cipher.final()
        
        const data = Buffer.concat([Buffer.from([0, 0, 0, 0]), signature])

        await request.httpRequest({
            host: this.ipAddress,
            method: 'POST',
            path: 'pair-verify',
            contentType: 'application/octet-stream',
            data: data
        })
    }
}
module.exports = Verifier
