// Attach as the server script of a dedicated persistent domain entity.
(function () {
    'use strict';
    var channel = 'ROBOTDOLLY_THEATRE_MK2', token = 'CHANGE-MK2-TOKEN', entity, timer, poll, pending = {}, attempts = 0;
    function send(m) { m.token = token; Messages.sendMessage(channel, JSON.stringify(m)); }
    function saved() {
        try { return JSON.parse(Entities.getEntityProperties(entity, ['userData']).userData || '{}').robotdollyMK2 || null; }
        catch (e) { return null; }
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
        if (m.source === 'actor' && pending[m.slot]) {
            var c = pending[m.slot]; delete pending[m.slot];
            actor(m.slot, 'configure', c); actor(m.slot, 'play'); return;
        }
        if (m.source !== 'controller' || m.target !== 'show') { return; }
        if (m.command === 'load') { send({ source: 'show', status: 'Loaded saved show', show: saved() }); }
        if (m.command === 'save') {
            if (!valid(m.show)) { send({ source: 'show', status: 'Invalid show' }); return; }
            try {
                var properties = Entities.getEntityProperties(entity, ['userData']);
                var data = JSON.parse(properties.userData || '{}');
                data.robotdollyMK2 = m.show;
                Entities.editEntity(entity, { userData: JSON.stringify(data) });
                // A read-back is only a local acknowledgement, not a disk durability guarantee.
                Script.setTimeout(function () {
                    var actual = saved();
                    send({ source: 'show', status: JSON.stringify(actual) === JSON.stringify(m.show) ? 'Show saved to domain entity' : 'Save not confirmed; check entity permissions' });
                }, 1500);
            } catch (e) { send({ source: 'show', status: 'Save failed: ' + e }); }
        }
    }
    this.preload = function (id) {
        entity = id; Messages.subscribe(channel); Messages.messageReceived.connect(receive);
        // Probe for configured agents for up to a minute after startup.
        timer = Script.setTimeout(function () { var s = saved(); if (s && s.restore) { restore(s); } }, 5000);
    };
    this.unload = function () { Script.clearTimeout(timer); Script.clearInterval(poll); Messages.messageReceived.disconnect(receive); Messages.unsubscribe(channel); };
});
