/** nav-height:24px */
const nav_height = 0;
/** footer-height: 42px */
const footer_height = 42;

let isDown = false

let deviceSize = {
    w: 1080,
    h: 1920
}

class DeviceInfo {
    constructor() {
        // 设备的物理大小
        this.physicsSize = {
            w: deviceSize.w,
            h: deviceSize.h
        }
        this.serialNumber = ""
    }
}

class DeviceWindow {
    constructor(win, deviceInfo, defaultDisplaySize={w:0, h:0}) {
        this.win = win // 操作的窗口
        this.deviceInfo = deviceInfo
        this.scale = 0.4 // minicap缩放比例
        this.rotate = false // 屏幕是否旋转，默认=false=竖屏
        this.keyMap = false // 是否键盘映射
        this.displaySize = defaultDisplaySize
    }

    resize(setCenter = true) {

        if (this.rotate) {
            [this.displaySize.w, this.displaySize.h] = [this.displaySize.h, this.displaySize.w]
        }

        let w = this.displaySize.w
        let h = this.displaySize.h + nav_height + footer_height
        
        this.win.setContentSize(w, h, false)
        if (setCenter) {
            this.win.center()
        }
    }
}

class Device {
    constructor(configObject, server) {
        this.w = configObject.w
        this.h = configObject.h
        this.sn = configObject.sn
        this.server = server
        this.net = null
        this.eventable = false
    }

    openConnection() {
        let net = new NetWork(this.server.ip, this.server.port)
        this.net = net
        let self = this
        net.connect({
            onopen() {
                self.connected = true
                net.request("M_WAIT", {sn: self.sn})
            },
            onclose() {
                self.connected = false
            },
            onmessage(msg) {
                let data = msg.data
                if (typeof(data) == 'string') {
                    this.ontext(data)
                } else {
                    this.onbinary(data)
                }
            },
            ontext(text) {
                let sp = text.indexOf('://')
                if (sp == -1) {
                    console.log("无效的协议")
                    this.onclose()
                }

                let head = text.substr(0, sp)
                let body = text.substring(sp + 3)

                let func = this[head]
                func.call(this, body)
            },
            onbinary(data) {
            },
            SM_SERVICE_STATE(body) {
                console.log("SM_SERVICE_STATE" + body)
                let obj = JSON.parse(body)
                console.warn(obj.type + ":" + obj.stat)
                if (obj.type == 'event' && obj.stat == 'open') {
                    self.eventable = true
                }
            },
            SM_OPENED(body) {
                // 只打开eventservice
                net.request("M_START", {type: "event"})
            },
        })
    }
}

class NetWork {
    constructor(ip, port) {
        this.ip = ip
        this.port = port
    }

    connect(config) {
        let webSocket = new WebSocket("ws://" + this.ip + ":" + this.port)
        webSocket.onopen = function() {
            config.onopen()
        }
        webSocket.onclose = function() {
            config.onclose()
        }
        webSocket.onmessage = function(data) { 
            config.onmessage(data)
        }
        this.webSocket = webSocket
    }

    request(name, argobj) {
        let ss = name + "://" + (argobj ? JSON.stringify(argobj) : "{}");
        this.webSocket.send(ss);
    }

    send(str) {
        console.log(str)
        this.webSocket.send(str)
    }
}

class Server {
    constructor(ip, port) {
        this.ip = ip
        this.port = port
        this.connected = false // 连接状态
        this.devices = []
    }

    connect() {
        let net = new NetWork(this.ip, this.port)
        this.net = net
        let self = this
        net.connect({
            onopen() {
                self.connected = true
                // 请求获取设备列表
                net.request("M_DEVICES", null)
            },
            onclose() {
                self.connected = false
            },
            onmessage(msg) {
                let data = msg.data
                if (typeof(data) == 'string') {
                    this.ontext(data)
                } else {
                    this.onbinary(data)
                }
            },
            ontext(text) {
                let sp = text.indexOf('://')
                if (sp == -1) {
                    console.log("无效的协议")
                    this.onclose()
                }

                let head = text.substr(0, sp)
                let body = text.substring(sp + 3)

                let func = this[head]
                func.call(this, body)
            },
            onbinary(data) {
            },
            SM_DEVICES(body) {
                let devicesConf = JSON.parse(body);
                self.devices = []
                for (let conf of devicesConf) {
                    let device = new Device(conf, self)
                    self.devices.push(device)
                }
                device_list.clearServerDevices(self)
                self.devices.map(d => {
                    device_list.devices.push(d)
                    d.openConnection()
                })
            },
        })
    }
}

let device_list = new Vue({
    data: {
        devices: [],
        name: "zhuhui"
    },
    methods: {
        /**
         * 删除相同服务器中的设备列表
         */
        clearServerDevices: function(server) {
            for(let i = 0; i < this.devices.length;) {
                if (this.devices[i].server == server) {
                    this.devices.splice(i, 1)
                    continue
                }
                i++
            }
        }
    }
})

let serverList = new Vue({
    el: '#phone-screen',
    data: {
        serverList: [
            /*
             {ip: 'localhost', port: 6655, connected: false}
             */
        ],
    },
    methods: {
        addServer: function (ip, port) {
            let server = new Server(ip, port)
            this.serverList.push(server)
            server.connect()
        }
    }
})

let deviceInfo = new DeviceInfo()
window.onload = function() {
    // 滑动条初始化
    var displayScaleSlider = $("#display-scale-slider").slider({
        max: 100,
        min: 10,
        step: 5,
        value: 20,
        change: onDisplayScaleChange
    })

    $('#rotateCheckBox').on('click', function() {
        deviceWindow.rotate = $('#rotateCheckBox').prop('checked')
        net.request("M_START", {type: "cap", config: {rotate: deviceWindow.rotate ? 90 : 0, scale: deviceWindow.scale}})
        // 隐藏设置窗口
        $('#myModal').modal('hide')
        // 显示等待capservice窗口
        $('#resetScaleModal').modal('show')

        onDisplayScaleChange()
    })

    $('#keyEventCheckBox').on('click', function() {
        deviceWindow.keyMap = $('#keyEventCheckBox').prop('checked')
    })


    function onDisplayScaleChange() {
        let scale = displayScaleSlider.slider("value") / 100.0;
        deviceWindow.displaySize.w = parseInt(deviceInfo.physicsSize.w * scale)
        deviceWindow.displaySize.h = parseInt(deviceInfo.physicsSize.h * scale)
        deviceWindow.resize(false)

        canvas.width = deviceWindow.displaySize.w;
        canvas.height = deviceWindow.displaySize.h;
        g.drawImage(canvas.img, 0, 0, canvas.width, canvas.height);
    }

    // electron初始化
    if (typeof(require) != 'undefined') {
        var currentWindow = require('electron').remote.getCurrentWindow()
        // 打开开发者模式
        // currentWindow.openDevTools();

        // 初始化窗口
        let scale = displayScaleSlider.slider("value") / 100.0;
        deviceWindow = new DeviceWindow(currentWindow || window, deviceInfo, {
            w: deviceInfo.physicsSize.w * scale, 
            h: deviceInfo.physicsSize.h * scale
        })
        deviceWindow.resize()
    }

    // 连接服务器
    
    let serversConfig = JSON.parse(window.localStorage.getItem('svrlst'))

    for(serverConf of serversConfig) {
        serverList.addServer(serverConf.ip, serverConf.port)
    }
}

$("#btn-menu").on('click', function(){
})

$("#btn-home").on('click', function(){
})

$("#btn-back").on('click', function(){
})

let phone = document.getElementById("phone-screen");

// 获取鼠标在html中的绝对位置
function mouseCoords(event){
    if(event.pageX || event.pageY){
        return {x:event.pageX, y:event.pageY};
    }
    return{
        x:event.clientX + document.body.scrollLeft - document.body.clientLeft,
        y:event.clientY + document.body.scrollTop - document.body.clientTop
    };
}
// 获取鼠标在控件的相对位置
function getXAndY(control, event){
    //鼠标点击的绝对位置
    Ev= event || window.event;
    var mousePos = mouseCoords(event);
    var x = mousePos.x;
    var y = mousePos.y;
    //alert("鼠标点击的绝对位置坐标："+x+","+y);

    //获取div在body中的绝对位置
    var x1 = control.offsetLeft;
    var y1 = control.offsetTop;

    //鼠标点击位置相对于div的坐标
    var x2 = x - x1;
    var y2 = y - y1;
    return {x:x2,y:y2};
}

function sendTouchEvent(minitouchStr) {
    for (device of device_list.devices) {
        if (device.eventable) {
            device.net.send("M_TOUCH://" + minitouchStr)
        }
    }
}

function sendKeyEvent(keyevent) {
    for (device of device_list.devices) {
        if (device.eventable) {
            device. net.send("M_KEYEVENT://" + keyevent)
        }
    }
}

function sendDown(argx, argy, isRo) {
    var scalex = deviceInfo.physicsSize.w / phone.offsetWidth;
    var scaley = deviceInfo.physicsSize.h / phone.offsetHeight;
    var x = argx, y = argy;
    if (isRo) {
        x = (phone.offsetHeight - argy) * (phone.offsetWidth / phone.offsetHeight);
        y = argx * (phone.offsetHeight / phone.offsetWidth);
    }
    x = Math.round(x * scalex);
    y = Math.round(y * scaley);
    var command = "d 0 " + x + " " + y + " 50\n";
    command += "c\n";
    sendTouchEvent(command);
}

function sendMove(argx, argy, isRo) {
    var scalex = deviceInfo.physicsSize.w / phone.offsetWidth;
    var scaley = deviceInfo.physicsSize.h / phone.offsetHeight;
    var x = argx, y = argy;
    if (isRo) {
        x = (phone.offsetHeight - argy) * (phone.offsetWidth / phone.offsetHeight);
        y = argx * (phone.offsetHeight / phone.offsetWidth);
    }
    x = Math.round(x * scalex);
    y = Math.round(y * scaley);

    var command = "m 0 " + x + " " + y + " 50\n";
    command += "c\n";
    sendTouchEvent(command);
}

function sendUp() {
    var command = "u 0\n";
    command += "c\n";
    sendTouchEvent(command);
}


phone.onmousedown = function (event) {
    isDown = true;
    var pos = getXAndY(phone, event);
    sendDown(pos.x, pos.y, deviceWindow.rotate);
};

phone.onmousemove = function (event) {
    if (!isDown) {
        return;
    }
    var pos = getXAndY(phone, event);

    sendMove(pos.x, pos.y, deviceWindow.rotate);
};

phone.onmouseover = function (event) {
    console.log("onmouseover");
};

phone.onmouseout = function (event) {
    if (!isDown) {
        return;
    }
    isDown = false;
    sendUp();
};

phone.onmouseup = function (event) {
    if (!isDown) {
        return;
    }
    isDown = false;
    sendUp();
};

