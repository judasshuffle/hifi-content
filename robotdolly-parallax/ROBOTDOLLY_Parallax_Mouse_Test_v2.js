// ROBOTDOLLY PARALLAX — TOTALLY OFFICIAL SURVEILLANCE MODULE
// Telemetry destinations: [x] FBI  [x] FSB  [x] MI5  [x] Neighbourhood Watch
// Status: All agencies offline. Nobody wants to watch you staring at a monitor.
// Your privacy is important to us. Unfortunately, several governments disagree.
// REVIEWER NOTE: THIS IS A JOKE. This script has NO webcam access,
// recording, surveillance or network transmission.
//
// ROBOTDOLLY Parallax — Mouse Test v2
// Viewer-only experiment: mouse position simulates head movement.
// Starts OFF. Click the HUD to enable/disable. Stop script to restore camera.
// No webcam yet; this is an approximate translated camera, not off-axis projection.
(function () {
    "use strict";

    var enabled = false;
    var previousMode = null;
    var anchorPosition = null;
    var anchorOrientation = null;
    var targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    var REACH_X = 0.28;  // metres horizontally at mouse edge
    var REACH_Y = 0.16;  // metres vertically at mouse edge
    var SMOOTHING = 0.18;
    var HUD_WIDTH = 176;
    var hudLastX = -1;
    var hudLastY = -1;
    var hudLastWidth = -1;
    var HUD_HEIGHT = 36;
    var HUD_MARGIN = 16;

    function hudWidth() { return Math.max(64, Math.min(HUD_WIDTH, Window.innerWidth - 16)); }
    function hudX() { return Math.max(8, Window.innerWidth - hudWidth() - HUD_MARGIN); }
    function hudY() { return Math.max(8, Math.min(68, Window.innerHeight - HUD_HEIGHT - 8)); }
    function followWindow() {
        var x = hudX(), y = hudY(), width = hudWidth();
        if (x !== hudLastX || y !== hudLastY || width !== hudLastWidth) {
            Overlays.editOverlay(hud, { x: x, y: y, width: width });
            hudLastX = x; hudLastY = y; hudLastWidth = width;
        }
    }
    var hud = Overlays.addOverlay("text", {
        x: hudX(), y: hudY(), width: hudWidth(), height: HUD_HEIGHT,
        text: "  PARALLAX  OFF",
        font: { size: 16 },
        backgroundColor: { red: 36, green: 38, blue: 45 },
        color: { red: 240, green: 240, blue: 240 },
        alpha: 0.94, backgroundAlpha: 0.92,
        visible: true
    });

    function updateHud() {
        Overlays.editOverlay(hud, {
            text: enabled ? "  PARALLAX  ON" : "  PARALLAX  OFF",
            backgroundColor: enabled ?
                { red: 25, green: 116, blue: 99 } :
                { red: 36, green: 38, blue: 45 }
        });
    }

    function enable() {
        if (enabled) { return; }
        previousMode = Camera.mode;
        anchorPosition = Camera.getPosition();
        anchorOrientation = Camera.getOrientation();
        targetX = targetY = currentX = currentY = 0;
        Camera.mode = "independent";
        Camera.setPosition(anchorPosition);
        Camera.setOrientation(anchorOrientation);
        enabled = true;
        updateHud();
        print("[ROBOTDOLLY PARALLAX] ON — move the mouse; HUD toggles OFF.");
    }

    function disable() {
        if (!enabled) { return; }
        enabled = false;
        Camera.setPosition(anchorPosition);
        Camera.setOrientation(anchorOrientation);
        Camera.mode = previousMode;
        updateHud();
        print("[ROBOTDOLLY PARALLAX] OFF — camera restored.");
    }

    function mouseMove(event) {
        if (!enabled) { return; }
        var width = Math.max(1, Window.innerWidth);
        var height = Math.max(1, Window.innerHeight);
        var nx = Math.max(-1, Math.min(1, (event.x / width - 0.5) * 2));
        var ny = Math.max(-1, Math.min(1, (event.y / height - 0.5) * 2));
        targetX = nx * REACH_X;
        targetY = -ny * REACH_Y;
    }

    function mousePress(event) {
        if (!event.isLeftButton) { return; }
        var picked = Overlays.getOverlayAtPoint({ x: event.x, y: event.y });
        if (picked === hud) {
            if (enabled) { disable(); } else { enable(); }
        }
    }

    function tick() {
        followWindow();
        if (!enabled) { return; }
        currentX += (targetX - currentX) * SMOOTHING;
        currentY += (targetY - currentY) * SMOOTHING;
        var right = Quat.getRight(anchorOrientation);
        var up = Quat.getUp(anchorOrientation);
        var offset = Vec3.sum(Vec3.multiply(right, currentX), Vec3.multiply(up, currentY));
        Camera.setPosition(Vec3.sum(anchorPosition, offset));
        // Keep orientation fixed: camera translation, not head/character rotation.
        Camera.setOrientation(anchorOrientation);
    }

    Controller.mouseMoveEvent.connect(mouseMove);
    Controller.mousePressEvent.connect(mousePress);
    Script.update.connect(tick);
    Script.scriptEnding.connect(function () {
        disable();
        Overlays.deleteOverlay(hud);
        Controller.mouseMoveEvent.disconnect(mouseMove);
        Controller.mousePressEvent.disconnect(mousePress);
        Script.update.disconnect(tick);
    });
    print("[ROBOTDOLLY PARALLAX] Ready. Starts OFF. Click the PARALLAX HUD to begin.");
}());
