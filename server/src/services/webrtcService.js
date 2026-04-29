export const handleWebRTCSignaling = (io, socket) => {
    socket.on('webrtc:offer', (data) => {
        socket.to(data.targetId).emit('webrtc:offer', {
            callerId: data.callerId, 
            sdp: data.sdp
        });
        console.log(`[WebRTC] Offer sent from ${data.callerId} to ${data.targetId}`);
    });

    socket.on('webrtc:answer', (data) => {
        socket.to(data.targetId).emit('webrtc:answer', {
            answererId: data.answererId,
            sdp: data.sdp
        });
        console.log(`[WebRTC] Answer sent from ${data.answererId} to ${data.targetId}`);
    });

    socket.on('webrtc:ice-candidate', (data) => {
        socket.to(data.targetId).emit('webrtc:ice-candidate', {
            senderId: data.senderId,
            candidate: data.candidate
        });
    });
};