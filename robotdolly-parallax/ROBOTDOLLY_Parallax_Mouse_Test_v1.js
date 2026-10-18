// ROBOTDOLLY Parallax — Mouse Test v1
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
    var HUD_HEIGHT = 36;
    var HUD_MARGIN = 16;

    function hudX() { return Math.max(8, Window.innerWidth - HUD_WIDTH - HUD_MARGIN); }
    var hud = Overlays.addOverlay("text", {
        x: hudX(), y: 68, width: HUD_WIDTH, height: HUD_HEIGHT,
        text: "  PARALLAX  OFF",
        font: { size: 16 },
        backgroundColor: { red: 36, green: 38, blue: 45 },
        color: { red: 240, green: 240, blue: 240 },
        alpha: 0.94, backgroundAlpha: 0.92,
        visible: true
    });

    function updateHud() {
        Overlays.editOverlay(hud, {
            x: hudX(),
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
