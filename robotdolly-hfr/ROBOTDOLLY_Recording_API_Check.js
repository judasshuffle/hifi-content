// ROBOTDOLLY HFR API CHECK — viewer script; read-only, no recording actions.
(function () {
    'use strict';
    var x = 35, y = 530, ids = [];
    function line(s, n) {
        print('[ROBOTDOLLY API CHECK] ' + s);
        ids.push(Overlays.addOverlay('text', {
            x: x, y: y + n * 28, width: 650, height: 27, text: s,
            font: { size: 13 }, leftMargin: 8, topMargin: 4,
            color: { red: 255, green: 255, blue: 255 },
            backgroundColor: { red: 22, green: 26, blue: 38 },
            backgroundAlpha: 0.97, visible: true
        }));
    }
    function check(object, objectName, members, startIndex) {
        for (var j = 0; j < members.length; j++) {
            var type = 'undefined';
            try { type = typeof object[members[j]]; } catch (e) { type = 'ERROR ' + e; }
            line(objectName + '.' + members[j] + ' = ' + type, startIndex + j);
        }
    }
    line('ROBOTDOLLY RECORDING API CHECK (stop script to dismiss)', 0);
    check(typeof MyAvatar === 'undefined' ? {} : MyAvatar, 'MyAvatar',
          ['startRecording', 'stopRecording', 'isRecording', 'loadLastRecording', 'saveRecording', 'loadRecording'], 1);
    check(typeof Recording === 'undefined' ? {} : Recording, 'Recording',
          ['startRecording', 'stopRecording', 'isRecording', 'loadRecording', 'saveRecording', 'startPlaying', 'stopPlaying'], 7);
    Script.scriptEnding.connect(function () {
        for (var i = 0; i < ids.length; i++) { Overlays.deleteOverlay(ids[i]); }
    });
}());
