// Register this single URL as a persistent script with multiple copies.
// Each copy reserves one type-2 worker while it runs.
var ROBOTDOLLY_MK2_SLOT = 0;
(function () {
    'use strict';
    var channel = 'ROBOTDOLLY_MK2_GREATATUIN_TEST_V1', token = 'PUBLIC-GREATATUIN-MK2-TEST-V1';
    var id = String(Date.now()) + '-' + Math.random() + '-' + Math.random(), slot = 0, lastReply = 0;
    function send() { Messages.sendMessage(channel, JSON.stringify({ source: 'worker', token: token, id: id })); }
    function receive(ch, message) {
        if (ch !== channel) { return; }
        var m; try { m = JSON.parse(message); } catch (e) { return; }
        if (!m || m.source !== 'coordinator' || m.token !== token || m.id !== id || !m.slot) { return; }
        if (slot && slot !== m.slot) { Script.stop(); return; }
        lastReply = Date.now();
        if (!slot) {
            slot = m.slot;
            // Script.include evaluates actor.js in this script engine's global scope.
            ROBOTDOLLY_MK2_SLOT = slot;
            Script.include(Script.resolvePath('actor.js'));
        }
    }
    Messages.subscribe(channel); Messages.messageReceived.connect(receive);
    var timer = Script.setInterval(function () {
        if (slot && Date.now() - lastReply > 8000) { Script.stop(); return; }
        send();
    }, 2000);
    Script.scriptEnding.connect(function () { Script.clearInterval(timer); Messages.messageReceived.disconnect(receive); Messages.unsubscribe(channel); });
    send();
}());
