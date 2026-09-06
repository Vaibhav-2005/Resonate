import { rooms } from './roomService.js';

export const handleClockSync = (io, socket) => {
    socket.on('sync:ping', (clientRequestTime, callback) => {
        const serverReceiveTime = Date.now();
        callback({
            clientRequestTime,
            serverReceiveTime,
            serverSendTime: Date.now(),
        });
    });

    socket.on('player:report', (data) => {
        const { roomId, positionMs, isPlaying } = data;
        if (!rooms.has(roomId)) return;

        const room = rooms.get(roomId);

        if (room.host === socket.id) {
            room.positionMs = positionMs;
            room.anchorPositionMs = positionMs;
            room.anchorServerTime = Date.now();
            room.isPlaying = isPlaying;
            room.lastHostReportTime = Date.now();

            socket.to(roomId).emit('media:drift', {
                positionMs,
                serverTime: Date.now(),
            });
        }
    });
};