export const handleRoomEvents = (io, socket) => {
    // HOST CREATES ROOM
    socket.on('room:create', (roomId, callback) => {
        socket.join(roomId);
        console.log(`[🟢 Room] Host ${socket.id} created party: ${roomId}`);
        callback({ success: true, message: `Room ${roomId} created.` });
    });

    // GUEST JOINS ROOM
    socket.on('room:join', (roomId, callback) => {
        // 1. Validate if the room actually exists in the server memory
        const roomExists = io.sockets.adapter.rooms.has(roomId);
        
        if (!roomExists) {
            console.log(`[🔴 Room] ${socket.id} tried to join non-existent room: ${roomId}`);
            return callback({ success: false, message: "Party code not found." });
        }

        // 2. If it exists, let them in
        socket.join(roomId);
        console.log(`[🟢 Room] Guest ${socket.id} joined party: ${roomId}`);
        
        // Notify the Host so they can start the WebRTC handshake
        socket.to(roomId).emit('room:user_joined', { userId: socket.id });
        
        callback({ success: true, message: `Joined room ${roomId}.` });
    });

    // HOST FIRES PLAY COMMAND
    socket.on('media:play', (data) => {
        console.log(`[▶️ Play] Host told room ${data.roomId} to play at ${data.playAtTimestamp}`);
        io.to(data.roomId).emit('media:sync_start', {
            playAtTimestamp: data.playAtTimestamp,
            mediaUrl: data.mediaUrl
        });
    });
};