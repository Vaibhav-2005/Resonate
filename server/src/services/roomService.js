export const handleRoomEvents = (io, socket) => {
    socket.on('room:create', (roomId, callback) => {
        if (rooms.has(roomId)) {
            return callback({ success: false, message: 'Room code already exists.' });
        }

        rooms.set(roomId, {
            host: socket.id,
            members: new Map(),
            track: null,
            positionMs: 0,
            isPlaying: false,
            anchorPositionMs: 0,
            anchorServerTime: 0,
        });

        socket.join(roomId);
        rooms.get(roomId).members.set(socket.id, { socketId: socket.id, isHost: true, displayName: 'Host'});

        console.log(`[🟢 Room] Host ${socket.id} created party: ${roomId}`);
        callback({ success: true, roomId });
    });

    socket.on('room:join', ({ roomId, displayName }, callback) => {
        if (!rooms.has(roomId)) {
            console.log(`[🔴 Room] ${socket.id} tried to join non-existent room: ${roomId}`);
            return callback({ success: false, message: 'Party code not found.' });
        }

        socket.join(roomId);
        const room = rooms.get(roomId);
        room.members.set(socket.id, { socketId: socket.id, isHost: false, displayName: displayName || 'Guest' });

        console.log(`[🟢 Room] Guest ${socket.id} joined party: ${roomId}`);

        socket.to(roomId).emit('room:user_joined', {
            userId: socket.id,
            members: Array.from(room.members.values())
        });

        callback({
            success: true,
            roomId,
            members: Array.from(room.members.values()),
            track: room.track,
            anchorPositionMs: room.anchorPositionMs,
            anchorServerTime: room.anchorServerTime,
            isPlaying: room.isPlaying,
        });
    });

    socket.on('room:leave', (roomId) => {
        if (!rooms.has(roomId)) return;
        const room = rooms.get(roomId);
        room.members.delete(socket.id);
        socket.leave(roomId);

        if (room.host === socket.id) {
            rooms.delete(roomId);
            io.to(roomId).emit('room:host_left', { roomId });
        } else {
            io.to(roomId).emit('room:user_left', { userId: socket.id, members: Array.from(room.members.values()) });
            if (room.members.size === 0) rooms.delete(roomId);
        }
    });

    socket.on('media:control', (data) => {
        const { roomId, action, positionMs, trackUri } = data;
        if (!rooms.has(roomId)) return;

        const room = rooms.get(roomId);
        if (room.host !== socket.id) return;
        const now = Date.now();

        switch (action) {
            case 'play': {
                room.track = { uri: trackUri, positionMs: positionMs, serverTime: now };
                room.anchorPositionMs = positionMs;
                room.anchorServerTime = now;
                room.isPlaying = true;

                io.to(roomId).emit('media:sync_start', {
                    trackUri,
                    anchorPositionMs: positionMs,
                    anchorServerTime: now,
                    broadcastTime: now,
                });
                console.log(`[▶️ Play] Broadcast sync_start for room ${roomId}`);
                break;
            }
            case 'pause': {
                room.isPlaying = false;
                io.to(roomId).emit('media:sync_pause', {
                    anchorServerTime: now,
                });
                console.log(`[⏸️ Pause] Broadcast sync_pause for room ${roomId}`);
                break;
            }
            case 'seek': {
                room.positionMs = positionMs;
                room.anchorPositionMs = positionMs;
                room.anchorServerTime = now;
                io.to(roomId).emit('media:sync_seek', {
                    anchorPositionMs: positionMs,
                    anchorServerTime: now,
                });
                console.log(`[⏭️ Seek] Broadcast sync_seek for room ${roomId} pos=${positionMs}`);
                break;
            }
        }
    });
};


export const handleDisconnect = (io, socket) => {
    for (const [roomId, room] of rooms.entries()) {
        if (!room.members.has(socket.id)) continue;

        room.members.delete(socket.id);

        if (room.host === socket.id) {
            rooms.delete(roomId);
            io.to(roomId).emit('room:host_left', { roomId });
        } else {
            io.to(roomId).emit('room:user_left', {
                userId: socket.id,
                members: Array.from(room.members.values())
            });
            if (room.members.size === 0) rooms.delete(roomId);
        }
    }
};

export const rooms = new Map();