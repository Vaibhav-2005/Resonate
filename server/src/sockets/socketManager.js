import { Server } from 'socket.io';
import { handleClockSync } from '../services/syncService.js';
import { handleRoomEvents } from '../services/roomService.js';
import { handleWebRTCSignaling } from '../services/webrtcService.js';

export const initializeSockets = (server) => {
    const io = new Server(server, {
        cors: {
            origin: '*', 
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket) => {
        console.log(`[+] New connection: ${socket.id}`);

        handleClockSync(socket);
        handleRoomEvents(io, socket);
        handleWebRTCSignaling(io, socket);

        socket.on('disconnecting', () => {
            for (const room of socket.rooms) {
                if (room !== socket.id) {
                    socket.to(room).emit('room:user_left', { userId: socket.id });
                    console.log(`[Room] ${socket.id} left room ${room}`);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log(`[-] Disconnected: ${socket.id}`);
        });
    });

    return io;
};