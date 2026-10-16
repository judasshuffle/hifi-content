// ROBOTDOLLY ACTOR CONTROLLER — experimental DarkRide viewer script.
// Runs in Interface, not on the domain server. No toolbar libraries required.
(function () {
    'use strict';
    var CHANNEL = 'ROBOTDOLLY_HFR_ACTOR_V1';
    var TOKEN = 'rd-actor-8c591a2f5e6b4d91';
    var ids = [], buttons = [], x = 35, y = 120;
    var LOOP = false;
    var statusID;

    function add(type, opts) { var id = Overlays.addOverlay(type, opts); ids.push(id); return id; }
    function text(t, px, py, w, h, bg, size) {
        return add('text', {
            x: px, y: py, width: w, height: h, text: t,
            font: { size: size || 15 },
            color: { red: 245, green: 245, blue: 250 },
            backgroundColor: bg || { red: 37, green: 42, blue: 59 },
            backgroundAlpha: 0.98, alpha: 1, leftMargin: 9, topMargin: 7, visible: true
        });
    }
    function button(name, px, py, w, cb, bg) {
        var id = text(name, px, py, w, 34, bg);
        buttons.push({ id: id, cb: cb });
    }
    function status(s) { print('[ROBOTDOLLY ACTOR] ' + s); Overlays.editOverlay(statusID, { text: s }); }
    function send(command, extra) {
        var data = extra || {};
        data.source = 'controller'; data.token = TOKEN; data.command = command;
        Messages.sendMessage(CHANNEL, JSON.stringify(data));
    }
    function frontPosition(distance) {
        var p = MyAvatar.position;
        var f = Quat.getFront(MyAvatar.orientation);
        return { x: p.x + f.x * distance, y: p.y, z: p.z + f.z * distance };
    }
    function numeric(s) { return /^\s*-?\d+(?:\.\d+)?\s*$/.test(s); }
    function moveXYZ() {
        var raw = Window.prompt('Actor position X, Y, Z (commas between numbers)',
                                [MyAvatar.position.x.toFixed(1), MyAvatar.position.y.toFixed(1), MyAvatar.position.z.toFixed(1)].join(','));
        if (!raw) { return; }
        var parts = raw.split(',');
        if (parts.length !== 3 || !numeric(parts[0]) || !numeric(parts[1]) || !numeric(parts[2])) {
            status('Enter three numbers: X,Y,Z'); return;
        }
        send('move', { position: { x: Number(parts[0]), y: Number(parts[1]), z: Number(parts[2]) } });
        status('Moving actor to XYZ...');
    }
    function loadURL() {
        var url = Window.prompt('Recording URL on the domain asset server (atp:/...)', 'atp:/hifipoem.hfr');
        if (url) { send('load', { url: url.trim() }); status('Asked server to load ' + url); }
    }
    text('ROBOTDOLLY  |  HFR ACTOR', x, y, 423, 37, { red: 22, green: 26, blue: 38 }, 18);
    button('FRONT', x, y + 42, 76, function () { send('move', { position: frontPosition(3) }); status('Positioning 3m ahead'); });
    button('HERE', x + 81, y + 42, 65, function () { send('move', { position: frontPosition(1.5) }); status('Positioning nearby'); });
    button('XYZ...', x + 151, y + 42, 79, moveXYZ);
    button('LOAD URL', x + 235, y + 42, 105, loadURL);
    button('CHECK', x + 345, y + 42, 78, function () { send('ping'); status('Checking agent...'); });
    button('PLAY', x, y + 83, 88, function () { send('play'); status('Play requested'); }, { red: 32, green: 101, blue: 71 });
    button('STOP', x + 93, y + 83, 88, function () { send('stop'); status('Stop requested'); }, { red: 133, green: 46, blue: 56 });
    button('LOOP OFF', x + 186, y + 83, 103, function () {
        LOOP = !LOOP; send('loop', { value: LOOP });
        Overlays.editOverlay(buttons[7].id, { text: LOOP ? 'LOOP ON' : 'LOOP OFF' });
    });
    button('CLOSE', x + 294, y + 83, 129, function () { Script.stop(); });
    statusID = text('Waiting for agent. Click CHECK.', x, y + 125, 423, 45, { red: 22, green: 26, blue: 38 }, 12);

    function received(channel, message) {
        if (channel !== CHANNEL) { return; }
        var data;
        try { data = JSON.parse(message); } catch (e) { return; }
        if (data.source === 'actor' && data.token === TOKEN) { status(data.status); }
    }
    function click(ev) {
        var hit = Overlays.getOverlayAtPoint({ x: ev.x, y: ev.y });
        for (var i = 0; i < buttons.length; i++) {
            if (hit === buttons[i].id) {
                try { buttons[i].cb(); } catch (e) { status('Error: ' + e); }
                return;
            }
        }
    }
    function cleanup() {
        Controller.mousePressEvent.disconnect(click);
        Messages.messageReceived.disconnect(received);
        Messages.unsubscribe(CHANNEL);
        for (var i = 0; i < ids.length; i++) { Overlays.deleteOverlay(ids[i]); }
    }
    Messages.subscribe(CHANNEL);
    Messages.messageReceived.connect(received);
    Controller.mousePressEvent.connect(click);
    Script.scriptEnding.connect(cleanup);
    status('Ready. Click CHECK to find server actor.');
}());