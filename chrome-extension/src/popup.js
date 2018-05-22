'use strict'

const $ = require('jquery')
const Promise = require('bluebird')
const _ = require('lodash')
const ytdl = require('ytdl-core')
const Errio = require('errio')

require('popper.js')
require('bootstrap')
require('bootstrap/dist/css/bootstrap.min.css')

const Pairing = require('../../lib/pair')

// Sections
const pairForm = $('#airplay-pair-form')
const pinForm = $('#airplay-pin-form')
const formatSelector = $('#airplay-format-selector')
const player = $('#airplay-player')

const pairSubmitButton = $('#airplay-pair-submit')
const unpairLink = $('#airplay-unpair')

async function run() {
    
    unpairLink.click(ev => {
        Promise.try(async() => {
            await performBackgroundAction('unpair')
            window.close()
        }).catch(err => {
            console.log(err)
        })
    })
    
    try {
        const { hasIpAddress } = await performBackgroundAction('pairing.hasIpAddress')
        if (!hasIpAddress) {
            return showPairForm()
        }
        await performBackgroundAction('verify')
        afterVerify()
    } catch (err) {
        showPairForm()
    }
}

run().catch(err => {
    console.error(err)
})

function setIsSubmitting(form, isSubmitting) {
    const spinner = $('.spinner', form)
    const submitButton = $('button[type=submit]')
    if (isSubmitting) {
        spinner.show()
        submitButton.prop('disabled', true)
    } else {
        spinner.hide()
        submitButton.prop('disabled', false)
    }
}

function setIsPaired() {
    unpairLink.show()
}

function afterVerify() {
    setIsPaired()
    Promise.try(async() => {
        const { playbackInfo } = await performBackgroundAction('playback.info')
        if (playbackInfo.isPlaying) {
            showPlayer()
        } else {
            showFormatSelector()
        }
    }).catch(err => {
        console.error(err)
    })
}

function showPairForm() {
    
    const pairIpAddressInput = $('#airplay-server-ip-input')
    const pairFeedback = $('invalid-feedback', pairForm)
    
    // Show pair form
    pairForm.show()
    setIsSubmitting(pairForm, false)
    
    pairForm.submit(ev => {
        ev.preventDefault()
        
        pairIpAddressInput.removeClass('is-invalid')
        pairForm.removeClass('was-validated')
        
        // Pair
        const ipAddress = pairIpAddressInput.val()
        pairSubmitButton.prop('disabled', true)
        setIsSubmitting(pairForm, true)
        
        Promise.try(async() => {
            await performBackgroundAction('pairing.setIpAddress', { ipAddress: ipAddress })
            await performBackgroundAction('pairing.start')
            pairForm.hide()
            showPinForm()
        }).catch(err => {
            
            console.error(err)
            
            pairFeedback.text(err.message)
            pairIpAddressInput.addClass('is-invalid')
            pairForm.addClass('was-validated')
            
            pairSubmitButton.prop('disabled', false)
        }).finally(() => {
            setIsSubmitting(pairForm, false)
        })
    })
}

function showPinForm() {
    
    const pinInput = $('#airplay-pin-input')
    
    // Pin
    pinForm.show()
    setIsSubmitting(pinForm, false)
    pinForm.removeClass('was-validated')
    
    const enterPin = async() => {
        
        const pin = await waitForPinSubmit()
        setIsSubmitting(pinForm, true)
        const promise = performBackgroundAction('pairing.enterPin', { pin })
        
        return Promise.resolve(promise)
        .catch(Pairing.InvalidPinError, err => {
            pinInput.get(0).setCustomValidity('Invalid PIN, please try again')
            pinForm.addClass('was-validated')
            setIsSubmitting(pinForm, false)
            return enterPin()
        })
        .catch(err => {
            pinInput.get(0).setCustomValidity(err.message)
            pinForm.addClass('was-validated')
            setIsSubmitting(pinForm, false)
            return enterPin()
        })
    }
    
    Promise.try(async() => {
        await enterPin()
        await performBackgroundAction('verify')
        
        pinForm.hide()
        afterVerify()
    }).catch(err => {
        console.error(err)
    })
}

async function getVideoFormats() {
    
    const currentTab = await getCurrentTab()
    const info = await ytdl.getInfo(currentTab.url, { debug: true })
    const formatsFromLowToHigh = _.chain(info.formats)
    .filter(format => {
        return format.container === 'mp4'
            && format.encoding === 'H.264'
            && format.audioEncoding === 'aac'
    })
    .sortBy(format => {
        const resolution = _.replace(format.resolution, 'p', '')
        return Number(resolution)
    })
    .value()
    
    console.log(info)
    console.log(info.formats)
    console.log(formatsFromLowToHigh)
    
    return formatsFromLowToHigh
}

async function pauseVideoInActiveTab() {
    const currentTab = await getCurrentTab()
    chrome.tabs.executeScript(currentTab.id, {
        code: "document.querySelector('video').pause()"
    })
}

function populateFormatSelector(videoFormats) {
    const formatList = $('#airplay-format-selector-list')
    formatList.html('')
    videoFormats.forEach(format => {
        const item = $(`<a class="list-group-item list-group-item-action">${format.resolution}</a>`)
        item.click(ev => {
            ev.preventDefault()
            console.log('Selected format', format)
            
            Promise.try(async() => {
                await performBackgroundAction('playback.play', { videoUrl: format.url })
                await pauseVideoInActiveTab()
                formatSelector.hide()
                showPlayer()
            }).catch(err => {
                console.error(err)
            })
        })
        formatList.append(item)
    })
}

function showFormatSelector() {
    
    formatSelector.show()
    
    const spinner = $('.spinner', formatSelector)
    spinner.show()
    
    Promise.try(async() => {
        const videoFormats = await getVideoFormats()
        spinner.hide()
        populateFormatSelector(videoFormats)
    }).catch(err => {
        console.log(err)
    })
}

function showPlayer() {
    
    player.show()
    const playPauseButton = $('#airplay-player-playpause')
    const stopButton = $('#airplay-player-stop')
    const slider = $('#airplay-player-slider')
    
    const setIsPlaying = isPlaying => {
        if (isPlaying) {
            playPauseButton.removeClass('fa-play')
            playPauseButton.addClass('fa-pause')
        } else {
            playPauseButton.removeClass('fa-pause')
            playPauseButton.addClass('fa-play')
        }
    }
    setIsPlaying(true)
    
    let intervalId = null
    const startProgressUpdates = () => {
        intervalId = setInterval(() => {
            Promise.try(async() => {
                const { playbackInfo } = await performBackgroundAction('playback.info')
                slider.attr('max', Math.floor(playbackInfo.duration))
                slider.val(Math.floor(playbackInfo.position))
            }).catch(err => {
                console.log(err)
            })
        }, 1000)
    }
    slider.val(0)
    startProgressUpdates()
    
    slider.change(ev => {
        Promise.try(async() => {
            const position = Number(slider.val())
            await performBackgroundAction('playback.seek', { position: position })
        }).catch(err => {
            console.log(err)
        })
    })
    
    playPauseButton.click(ev => {
        Promise.try(async() => {
            const { playbackInfo } = await performBackgroundAction('playback.info')
            if (playbackInfo.isPlaying) {
                await performBackgroundAction('playback.pause')
                setIsPlaying(false)
                clearInterval(intervalId)
            } else {
                await performBackgroundAction('playback.resume')
                setIsPlaying(true)
                startProgressUpdates()
            }
        }).catch(err => {
            console.log(err)
        })
    })
    
    stopButton.click(ev => {
        Promise.try(async() => {
            await performBackgroundAction('playback.stop')
            window.close()
        }).catch(err => {
            console.log(err)
        })
    })
}

async function waitForPinSubmit() {
    const pinInput = $('#airplay-pin-input')
    return new Promise((fulfill, reject) => {
        pinForm.submit(ev => {
            
            ev.preventDefault()
            
            pinInput.get(0).setCustomValidity('')
            const validationResult = pinForm.get(0).checkValidity()
            pinForm.addClass('was-validated')
            
            if (validationResult === false) {
                return
            }
            
            const pin = pinInput.val()
            fulfill(pin)
        })
    })
}

async function getCurrentTab() {
    return new Promise((fulfill, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            fulfill(tabs[0] || null)
        })
    })
}

async function performBackgroundAction(action, params) {
    params = params || {}
    return new Promise((fulfill, reject) => {
        chrome.runtime.sendMessage({ action: action, ...params }, response => {
            if (!response) {
                const message = _.get(chrome, 'runtime.lastError.message', 'Unknown runtime error')
                const err = new Error(message)
                return reject(err)
            }
            if (response.error) {
                const err = Errio.fromObject(response.error)
                return reject(err)
            }
            fulfill(response)
        })
    })
}
