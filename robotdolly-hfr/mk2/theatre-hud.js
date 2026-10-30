// Run in DarkRide Interface. The assignment clients and show entity run independently.
(function () {
    'use strict';
    var channel = 'ROBOTDOLLY_THEATRE_MK2', token = 'CHANGE-MK2-TOKEN';
    var ids = [], buttons = [], actors = [null, null, null, null, null], statuses = ['Unknown', 'Unknown', 'Unknown', 'Unknown', 'Unknown'];
    var selected = 0, restore = false, showLoop = false, statusId, castId, selectionId, loopId, restoreId;
    var x = 30, y = 80, bg = { red: 29, green: 34, blue: 43 }, bar = { red: 18, green: 22, blue: 29 }, accent = { red: 39, green: 88, blue: 96 };
    function text(label, px, py, w, h, color, size) {
        var id = Overlays.addOverlay('text', { x: px, y: py, width: w, height: h, text: label, backgroundColor: color || bg,
            backgroundAlpha: 0.96, color: { red: 237, green: 240, blue: 244 }, alpha: 1, font: { size: size || 14 }, leftMargin: 8, topMargin: 6 });
        ids.push(id); return id;
    }
    function button(label, px, py, w, fn) { var id = text(label, px, py, w, 31, accent, 13); buttons.push({ id: id, fn: fn }); return id; }
    function status(s) { Overlays.editOverlay(statusId, { text: s }); print('[Theatre MK2] ' + s); }
    function refresh() {
        var c = actors[selected];
        Overlays.editOverlay(selectionId, { text: 'Selected: Actor ' + (selected + 1) + ' | ' + (c ? c.url : 'No recording') });
        Overlays.editOverlay(castId, { text: statuses.map(function (s, i) { return (i + 1) + ': ' + s; }).join('   |   ') });
        Overlays.editOverlay(loopId, { text: 'Loop Show: ' + (showLoop ? 'ON' : 'OFF') });
        Overlays.editOverlay(restoreId, { text: 'Restore on restart: ' + (restore ? 'ON' : 'OFF') });
    }
    function send(m) { m.source = 'controller'; m.token = token; Messages.sendMessage(channel, JSON.stringify(m)); }
    function actor(command, value, index) { send({ slot: (index === undefined ? selected : index) + 1, command: command, config: value, value: value }); }
    function initial() { return actors[selected] || { url: '', placement: 'original', position: null, volume: 1, loop: showLoop }; }
    function configure() { if (!actors[selected] || !actors[selected].url) { status('Choose a recording first'); return; } actor('configure', actors[selected]); }
    function record() { Recording.startRecording(); status('Recording your avatar and microphone'); }
    function stopRecord() { Recording.stopRecording(); status('Recording stopped. Save it as an HFR file.'); }
    function saveRecording() {
        var p = Window.save('Save HFR recording', Recording.getDefaultRecordingSaveDirectory ? Recording.getDefaultRecordingSaveDirectory() : '.', 'High Fidelity recordings (*.hfr)');
        if (p && p !== 'null') { Recording.saveRecording(/\.hfr$/i.test(p) ? p : p + '.hfr'); status('Recording save requested'); }
    }
    function chooseRecording() {
        var c = initial(), url = Window.prompt('Recording URL (atp: or https:)', c.url);
        if (!url) { return; } url = url.trim();
        if (!/^(atp:|https?:\/\/)/i.test(url) || url.length >= 2048) { status('Enter an atp: or HTTP(S) recording URL'); return; }
        c.url = url; actors[selected] = c; configure(); refresh();
    }
    function place() {
        var s = Window.prompt('Placement:\n1. Original Recorded Location\n2. Here\n3. In Front of Me\n4. Custom Coordinates', '1');
        if (!/^[1-4]$/.test(s || '')) { return; }
        var c = initial(), p = MyAvatar.position;
        if (s === '1') { c.placement = 'original'; c.position = null; }
        else {
            if (s === '3') { var f = Quat.getFront(MyAvatar.orientation); p = { x: p.x + 3 * f.x, y: p.y, z: p.z + 3 * f.z }; }
            if (s === '4') {
                var raw = Window.prompt('World coordinates X, Y, Z', [p.x, p.y, p.z].join(','));
                if (!raw) { return; } var parts = raw.split(',');
                if (parts.length !== 3 || parts.some(function (n) { return !/^\s*-?\d+(?:\.\d+)?\s*$/.test(n) || Math.abs(Number(n)) >= 100000; })) { status('Enter three valid coordinates'); return; }
                p = { x: Number(parts[0]), y: Number(parts[1]), z: Number(parts[2]) };
            }
            c.placement = 'position'; c.position = { x: p.x, y: p.y, z: p.z };
        }
        actors[selected] = c; if (c.url) { configure(); } status('Placement set for Actor ' + (selected + 1)); refresh();
    }
    function volume() {
        var c = initial(), input = Window.prompt('Actor volume, 0 to 100', String(Math.round(c.volume * 100)));
        if (input === null || input === '') { return; } var n = Number(input);
        if (!isFinite(n) || n < 0 || n > 100) { status('Volume must be between 0 and 100'); return; }
        c.volume = n / 100; actors[selected] = c; actor('volume', c.volume); status('Actor ' + (selected + 1) + ' volume: ' + n + '%');
    }
    function each(command) { actors.forEach(function (c, i) { if (c && c.url) { actor(command, null, i); } }); }
    function receive(ch, message) {
        if (ch !== channel) { return; } var m; try { m = JSON.parse(message); } catch (e) { return; }
        if (!m || m.token !== token) { return; }
        if (m.source === 'actor' && m.slot >= 1 && m.slot <= 5) { statuses[m.slot - 1] = m.status; refresh(); }
        if (m.source === 'show') {
            if (m.show && m.show.version === 1 && Array.isArray(m.show.actors) && m.show.actors.length === 5) {
                actors = m.show.actors; restore = !!m.show.restore; showLoop = !!m.show.loop;
                actors.forEach(function (c, i) { if (c && c.url) { actor('configure', c, i); } }); refresh();
            }
            status(m.show === null ? 'No saved show found' : m.status);
        }
    }
    text('ROBOTDOLLY THEATRE MK2', x, y, 520, 35, bar, 18);
    text('RECORD', x, y + 40, 520, 27, bar);
    button('Start Recording', x, y + 71, 145, record); button('Stop Recording', x + 150, y + 71, 145, stopRecord); button('Save HFR', x + 300, y + 71, 110, saveRecording);
    text('CAST', x, y + 110, 520, 27, bar);
    for (var i = 0; i < 5; i++) { (function (n) { button('Actor ' + (n + 1), x + n * 104, y + 141, 100, function () { selected = n; refresh(); }); }(i)); }
    selectionId = text('', x, y + 177, 520, 29, bg, 12);
    castId = text('', x, y + 209, 520, 29, bg, 11);
    button('Choose Recording', x, y + 242, 145, chooseRecording); button('Placement', x + 150, y + 242, 100, place); button('Volume', x + 255, y + 242, 85, volume);
    button('Play Actor', x + 345, y + 242, 84, function () { actor('play'); }); button('Stop Actor', x + 433, y + 242, 87, function () { actor('stop'); });
    button('Loop Actor', x, y + 278, 110, function () { var c = initial(); c.loop = !c.loop; actors[selected] = c; actor('loop', c.loop); status('Actor loop ' + (c.loop ? 'on' : 'off')); });
    button('Check Actors', x + 115, y + 278, 115, function () { for (var j = 0; j < 5; j++) { statuses[j] = 'No response'; actor('ping', null, j); } refresh(); });
    text('SHOW', x, y + 316, 520, 27, bar);
    button('Play All', x, y + 347, 90, function () { each('play'); }); button('Stop All', x + 95, y + 347, 90, function () { each('stop'); });
    loopId = button('', x + 190, y + 347, 140, function () { showLoop = !showLoop; actors.forEach(function (c, j) { if (c) { c.loop = showLoop; actor('loop', showLoop, j); } }); refresh(); });
    button('Save Show', x, y + 383, 100, function () { send({ target: 'show', command: 'save', show: { version: 1, actors: actors, loop: showLoop, restore: restore } }); status('Saving show...'); });
    button('Load Show', x + 105, y + 383, 100, function () { send({ target: 'show', command: 'load' }); status('Loading show...'); });
    restoreId = button('', x + 210, y + 383, 220, function () { restore = !restore; refresh(); status('Save Show to keep this setting'); });
    statusId = text('Ready. Check actors, then choose recordings.', x, y + 420, 520, 37, bar, 12);
    button('Close', x + 435, y + 383, 85, function () { Script.stop(); });
    function click(ev) { var id = Overlays.getOverlayAtPoint({ x: ev.x, y: ev.y }); buttons.forEach(function (b) { if (b.id === id) { try { b.fn(); } catch (e) { status('Error: ' + e); } } }); }
    Messages.subscribe(channel); Messages.messageReceived.connect(receive); Controller.mousePressEvent.connect(click);
    Script.scriptEnding.connect(function () { Controller.mousePressEvent.disconnect(click); Messages.messageReceived.disconnect(receive); Messages.unsubscribe(channel); ids.forEach(function (id) { Overlays.deleteOverlay(id); }); });
    refresh();
}());
