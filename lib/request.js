'use strict'

const bplistCreator = require('bplist-creator')
const bplistParser = require('bplist-parser')
const fetch = require('node-fetch')
const http = require('http')
const URL = typeof window !== 'undefined' ? window.URL : require('url').URL // eslint-disable-line no-undef
const _ = require('lodash')

const appleTvPort = 7000

const agent = new http.Agent({
    keepAlive: true,
    maxSockets: 1
})

async function httpRequest({ host, method, path, qs, data, contentType }) {
    
    const dataBuffer = data ? (new Uint8Array(data)).buffer : null
    
    const requestUrl = new URL(`http://${host}:${appleTvPort}`)
    requestUrl.pathname = `/${path}`
    _.forEach(qs, (value, key) => {
        requestUrl.searchParams.set(key, value)
    })
    
    const response = await fetch(requestUrl.toString(), {
        method: method,
        headers: {
            'Content-Type': contentType,
            'User-Agent': 'AirPlay/320.20',
            'Connection': 'keep-alive'
        },
        body: dataBuffer,
        encoding: null,
        agent: agent
    })
    
    if (!response.ok) {
        const error = new Error(`Airplay request error: ${response.status}`)
        error.response = response
        throw error
    }
        
    const resArrayBuffer = await response.arrayBuffer()
    
    return Buffer.from(resArrayBuffer)
}

async function plistRequest({ host, method, path, qs, params }) {
    
    const data = params ? bplistCreator(params) : null
    
    const response = await httpRequest({
        host: host,
        method: method,
        path: path,
        data: data,
        qs: qs,
        contentType: 'application/x-apple-binary-plist'
    })
    
    if (response.length === 0) {
        return {}
    }
    
    const result = bplistParser.parseBuffer(response)
    
    return result
}

module.exports = {
    httpRequest,
    plistRequest,
}
