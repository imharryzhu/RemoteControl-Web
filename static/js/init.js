(function() {
    if (isBrowser()) {
        return
    }
    
    let app = require('electron').remote
    // window dragable
    setWindowDrag()
})();

function isBrowser() {
    if ('undefined' === typeof(require)) {
        return true
    } 
}

function setWindowDrag() {
    let css = `html, body {
                -webkit-app-region: drag;
                width: 100%;
                height: 100%;
            }`
    let style = document.createElement('style')
    style.media = 'screen'
    style.appendChild(document.createTextNode(css))
    document.getElementsByTagName("head")[0].appendChild(style)
}



