export const handleClockSync = (socket) => {
    socket.on('sync:ping', (clientRequestTime, callback) => {
        const serverReceiveTime = Date.now(); 
        const serverSendTime = Date.now(); 
        
        callback({
            clientRequestTime,
            serverReceiveTime,
            serverSendTime     
        });
    });
};