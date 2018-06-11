Chrome Airplay
==============

Play videos from Chrome to your Apple TV.

![](docs/screenshot.jpg)

Install
-------

Install from the Chrome Web Store: <https://chrome.google.com/webstore/detail/hbmlfaoeelcpjkhchbnjjefcibeadedc/publish-accepted?authuser=0&hl=en-US>

Supported websites
------------------

 - Youtube

Contribute
----------

### Clone

```
$ git clone git@github.com:ldiqual/chrome-airplay.git
$ npm install
```

File structure:

 - Chrome extension code is in `chrome-extension/`
 - Lib code is in `lib/`

### Build/watch JS files

Watch changes with webpack:

```
$ npm run watch:js:dev
```

### Load extension in Chrome

Go to <chrome://extensions/>, click `Load unpacked`, and select `chrome-extension/`.

### Lint

Lint the code with:

```
$ npm run lint
```

### Build for production

```
$ npm run build:chrome-extension:prod
```

This will output to `build/build.zip`.

Credits
-------

 - Airplay authentication: <https://htmlpreview.github.io/?https://github.com/philippe44/RAOP-Player/blob/master/doc/auth_protocol.html>
 - Airplay video endpoints: <http://nto.github.io/AirPlay.html#video>
 - atv-client: <https://github.com/googoid/atv-client>
 - Airplay icon: <https://www.flaticon.com/free-icon/airplay_565221>