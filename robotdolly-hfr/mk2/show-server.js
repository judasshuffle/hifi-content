// Attach as the server script of a dedicated persistent domain entity.
(function () {
    'use strict';
    var channel = 'ROBOTDOLLY_MK2_GREATATUIN_TEST_V1', token = 'PUBLIC-GREATATUIN-MK2-TEST-V1', entity, timer, poll, pending = {}, attempts = 0;
    var leases = {}, coordinatorReadyAt = 0;
    function send(m) { m.token = token; Messages.sendMessage(channel, JSON.stringify(m)); }
    function saved() {
        try { return JSON.parse(Entities.getEntityProperties(entity, ['userData']).userData || '{}').robotdollyMK2 || null; }
        catch (e) { return null; }
    }
    function readData() { return JSON.parse(Entities.getEntityProperties(entity, ['userData']).userData || '{}'); }
    function library() { var d = readData(); return Array.isArray(d.robotdollyMK2Library) ? d.robotdollyMK2Library : []; }
    var libraryBusy = false;
    function libraryCommand(m) {
        try {
            if (m.command === 'list') { send({ source: 'library', status: 'Library ready', library: library() }); return; }
            if (m.command !== 'add') { return; }
            if (libraryBusy) { send({ source: 'library', request: m.request, error: 'Library is busy; try again' }); return; }
            var item = m.item, data = readData(), items = Array.isArray(data.robotdollyMK2Library) ? data.robotdollyMK2Library : [];
            if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80 ||
                    typeof item.url !== 'string' || !/^atp:\/robotdolly-mk2\/[a-f0-9]{64}\.hfr$/i.test(item.url) ||
                    typeof item.created !== 'string' || typeof item.durationSeconds !== 'number' || !isFinite(item.durationSeconds) ||
                    typeof item.avatarModelURL !== 'string' || item.avatarModelURL.length > 2048) {
                send({ source: 'library', request: m.request, error: 'Invalid recording details' }); return;
            }
            if (items.some(function (x) { return x.name.toLowerCase() === item.name.toLowerCase(); })) {
                send({ source: 'library', request: m.request, error: 'A recording with that name already exists' }); return;
            }
            items.push(item); data.robotdollyMK2Library = items;
            if (JSON.stringify(data).length > 12000) { send({ source: 'library', request: m.request, error: 'Library is full' }); return; }
            libraryBusy = true; Entities.editEntity(entity, { userData: JSON.stringify(data) });
            Script.setTimeout(function () {
                try {
                    var actual = library(), found = actual.some(function (x) { return x.name === item.name && x.url === item.url; });
                    send({ source: 'library', request: m.request, library: actual, status: found ? 'Recording added to library' : '', error: found ? '' : 'Library save not confirmed' });
                } catch (e) { send({ source: 'library', request: m.request, error: 'Library read-back failed: ' + e }); }
                libraryBusy = false;
            }, 1500);
        } catch (e) { libraryBusy = false; send({ source: 'library', request: m.request, error: 'Library error: ' + e }); }
    }
    function valid(s) {
        return s && s.version === 1 && Array.isArray(s.actors) && s.actors.length === 5 &&
            typeof s.restore === 'boolean' && JSON.stringify(s).length < 12000;
    }
    function actor(slot, command, config) { send({ source: 'controller', slot: slot, command: command, config: config }); }
    function probe() {
        attempts++;
        Object.keys(pending).forEach(function (slot) { actor(Number(slot), 'ping'); });
        if (attempts >= 30 || Object.keys(pending).length === 0) { Script.clearInterval(poll); }
    }
    function restore(s) {
        if (!valid(s)) { return; }
        s.actors.forEach(function (c, i) { if (c && c.url) { pending[i + 1] = c; } });
        poll = Script.setInterval(probe, 2000); probe();
    }
    function receive(ch, message) {
        if (ch !== channel) { return; }
        var m; try { m = JSON.parse(message); } catch (e) { return; }
        if (!m || m.token !== token) { return; }
        if (m.source === 'worker' && typeof m.id === 'string' && m.id.length < 100) {
            var now = Date.now();
            // After a coordinator restart wait longer than the worker's 8s lease timeout.
            if (now < coordinatorReadyAt) { return; }
            Object.keys(leases).forEach(function (id) { if (now - leases[id].seen > 15000) { delete leases[id]; } });
            if (!leases[m.id]) {
                var used = {}; Object.keys(leases).forEach(function (id) { used[leases[id].slot] = true; });
                for (var n = 1; n <= 5; n++) { if (!used[n]) { leases[m.id] = { slot: n, seen: now }; break; } }
            }
            if (leases[m.id]) { leases[m.id].seen = now; send({ source: 'coordinator', id: m.id, slot: leases[m.id].slot }); }
            return;
        }
        if (m.source === 'actor' && pending[m.slot]) {
            var c = pending[m.slot]; delete pending[m.slot];
            actor(m.slot, 'configure', c); actor(m.slot, 'play'); return;
        }
        if (m.source !== 'controller') { return; }
        if (m.target === 'library') { libraryCommand(m); return; }
        if (m.target !== 'show') { return; }
        if (m.command === 'load') { send({ source: 'show', status: 'Loaded saved show', show: saved() }); }
        if (m.command === 'save') {
            if (!valid(m.show)) { send({ source: 'show', status: 'Invalid show' }); return; }
            if (libraryBusy) { send({ source: 'show', status: 'Storage busy; try again' }); return; }
            try {
                var properties = Entities.getEntityProperties(entity, ['userData']);
                var data = JSON.parse(properties.userData || '{}');
                data.robotdollyMK2 = m.show;
                libraryBusy = true;
                Entities.editEntity(entity, { userData: JSON.stringify(data) });
                // A read-back is only a local acknowledgement, not a disk durability guarantee.
                Script.setTimeout(function () {
                    var actual = saved();
                    send({ source: 'show', status: JSON.stringify(actual) === JSON.stringify(m.show) ? 'Show saved to domain entity' : 'Save not confirmed; check entity permissions' });
                    libraryBusy = false;
                }, 1500);
            } catch (e) { libraryBusy = false; send({ source: 'show', status: 'Save failed: ' + e }); }
        }
    }
    this.preload = function (id) {
        entity = id; leases = {}; coordinatorReadyAt = Date.now() + 12000; Messages.subscribe(channel); Messages.messageReceived.connect(receive);
        // Probe for configured agents for up to a minute after startup.
        timer = Script.setTimeout(function () { var s = saved(); if (s && s.restore) { restore(s); } }, 5000);
    };
    this.unload = function () { Script.clearTimeout(timer); Script.clearInterval(poll); Messages.messageReceived.disconnect(receive); Messages.unsubscribe(channel); };
});
