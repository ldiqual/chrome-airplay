'use strict'

const _ = require('lodash')

function assertIsBuffer(buffer, description, params) {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error(`Property ${description} is not a buffer`)
    }
    
    const minLength = params.minLength || 0
    if (buffer.length < minLength) {
        throw new Error(`Buffer ${description} has length ${buffer.length} (should be at least ${minLength})`)
    }
    
    params = params || {}
    if (params.length && buffer.length !== params.length) {
        throw new Error(`Buffer ${description} has length ${buffer.length} (should be ${params.length})`)
    }
}

// params: { minLength, length }
function assertIsString(str, description, params) {
    if (!_.isString(str)) {
        throw new Error(`Property ${description} is not a string`)
    }
    
    params = {}
    
    const minLength = params.minLength || 0
    if (str.length < minLength) {
        throw new Error(`String ${description} has length ${str.length} (should be at least ${minLength})`)
    }
    
    if (_.isNumber(params.length) && str.length !== params.length) {
        throw new Error(`String ${description} has length ${str.length} (should be ${params.length})`)
    }
}

function assertIsNotNull(param, description) {
    if (param === null) {
        throw new Error(`Property ${description} is null`)
    }
}

module.exports = {
    assertIsBuffer,
    assertIsString,
    assertIsNotNull
}
