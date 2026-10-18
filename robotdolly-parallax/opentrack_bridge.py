#!/usr/bin/env python3
"""ROBOTDOLLY Parallax: local OpenTrack UDP -> local WebSocket bridge.

Requires: pip install websockets>=11
OpenTrack Output: UDP over network, host 127.0.0.1, port 4242.
WebSocket endpoint: ws://127.0.0.1:8765
No images are received, recorded or transmitted.
"""
import asyncio
import json
import math
import socket
import struct
import time

from websockets.asyncio.server import serve

HOST = "127.0.0.1"
UDP_PORT = 4242
WS_PORT = 8765
clients = set()


async def on_client(websocket):
    clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        clients.discard(websocket)


async def receive_poses():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((HOST, UDP_PORT))
    sock.setblocking(False)
    loop = asyncio.get_running_loop()
    print(f"Receiving OpenTrack UDP at {HOST}:{UDP_PORT}")
    try:
        last_log = 0
        while True:
            data, _ = await loop.sock_recvfrom(sock, 256)
            if len(data) < 48:
                continue
            vals = struct.unpack("<6d", data[:48])
            if not all(math.isfinite(x) for x in vals):
                continue
            x, y, z, yaw, pitch, roll = vals
            message = json.dumps({
                "kind": "pose", "x": x, "y": y, "z": z,
                "yaw": yaw, "pitch": pitch, "roll": roll
            })
            if clients:
                # Stay local; never publish frames or images to the Internet.
                await asyncio.gather(
                    *(ws.send(message) for ws in tuple(clients)),
                    return_exceptions=True
                )
            now = time.monotonic()
            if now - last_log > 8:
                print(f"Tracking: X={x:.1f} Y={y:.1f} Z={z:.1f} cm; viewers={len(clients)}")
                last_log = now
    finally:
        sock.close()


async def main():
    print("ROBOTDOLLY Parallax Local Bridge")
    print("No webcam images leave your PC. Ctrl+C to stop.")
    async with serve(on_client, HOST, WS_PORT):
        print(f"Local viewer socket: ws://{HOST}:{WS_PORT}")
        await receive_poses()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBridge stopped.")
