import { Server } from 'socket.io';
import { handleClockSync } from '../services/syncService.js';
import { handleRoomEvents } from '../services/roomService.js';
import { handleDisconnect } from '../services/roomService.js';
import { handleWebRTCSignaling } from '../services/webRTCService.js';


export const initializeSockets = (server) => {
    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    
    io.on('connection', (socket) => {
        handleClockSync(io, socket);
        handleRoomEvents(io, socket);
        handleWebRTCSignaling(io, socket);
        socket.on('disconnecting', () => handleDisconnect(io, socket));
    });

    return io;
};