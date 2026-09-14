"use client";
import { useEffect, useRef, useState } from "react";

export function useWebRTC(socket, roomId) {
    const peersRef = useRef({}); 
    const dataChannelsRef = useRef({}); 
    
    // We use an Array to track connected IDs so we don't double-count anyone!
    const [connectedUsers, setConnectedUsers] = useState([]); 

    useEffect(() => {
        if (!socket) return;

        // --- HELPER 1: The Tunnel Manager ---
        const setupDataChannel = (channel, id) => {
            channel.onopen = () => {
                console.log(`[🟢 WebRTC] Direct tunnel OPENED with ${id}!`);
                // Add this user to our connected list
                setConnectedUsers(prev => {
                    if (!prev.includes(id)) return [...prev, id];
                    return prev;
                });
            };
            
            channel.onclose = () => {
                console.log(`[🔴 WebRTC] Tunnel closed with ${id}`);
                setConnectedUsers(prev => prev.filter(userId => userId !== id));
            };

            channel.onmessage = (event) => console.log("Received data chunk!");
            dataChannelsRef.current[id] = channel;
        };

        // --- HELPER 2: The Peer Builder ---
        const createPeer = (targetId) => {
            // If we already started building this peer, don't overwrite it!
            if (peersRef.current[targetId]) return peersRef.current[targetId];

            const peer = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }] 
            });

            peer.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("webrtc:ice-candidate", { targetId, senderId: socket.id, candidate: event.candidate });
                }
            };

            // Enhanced cleanup if the connection drops
            peer.onconnectionstatechange = () => {
                console.log(`[Status] Network state with ${targetId}: ${peer.connectionState}`);
                if (peer.connectionState === "disconnected" || peer.connectionState === "failed") {
                    setConnectedUsers(prev => prev.filter(id => id !== targetId));
                    delete peersRef.current[targetId];
                    delete dataChannelsRef.current[targetId];
                }
            };

            peersRef.current[targetId] = peer;
            return peer;
        };

        // --- THE HANDSHAKE LOGIC ---

        const handleUserJoined = async ({ userId }) => {
            console.log("New user joined! Initiating WebRTC to:", userId);
            const peer = createPeer(userId);
            
            const dataChannel = peer.createDataChannel("audio-stream", { ordered: false, maxRetransmits: 0 });
            setupDataChannel(dataChannel, userId);
            
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            
            socket.emit("webrtc:offer", { targetId: userId, callerId: socket.id, sdp: peer.localDescription });
        };

        const handleOffer = async ({ callerId, sdp }) => {
            const peer = createPeer(callerId);
            peer.ondatachannel = (event) => setupDataChannel(event.channel, callerId);

            await peer.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            
            socket.emit("webrtc:answer", { targetId: callerId, answererId: socket.id, sdp: peer.localDescription });
        };

        const handleAnswer = async ({ answererId, sdp }) => {
            const peer = peersRef.current[answererId];
            if (peer) await peer.setRemoteDescription(new RTCSessionDescription(sdp));
        };

        const handleIceCandidate = async ({ senderId, candidate }) => {
            try {
                // We ensure the peer exists just in case the ICE candidate arrived incredibly fast
                const peer = createPeer(senderId); 
                await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error("ICE Candidate Error:", error);
            }
        };

        socket.on("room:user_joined", handleUserJoined);
        socket.on("webrtc:offer", handleOffer);
        socket.on("webrtc:answer", handleAnswer);
        socket.on("webrtc:ice-candidate", handleIceCandidate);

        return () => {
            socket.off("room:user_joined", handleUserJoined);
            socket.off("webrtc:offer", handleOffer);
            socket.off("webrtc:answer", handleAnswer);
            socket.off("webrtc:ice-candidate", handleIceCandidate);
        };
    }, [socket]);

    const broadcastFile = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const CHUNK_SIZE = 16384; 

        Object.values(dataChannelsRef.current).forEach(channel => {
            if (channel.readyState === "open") {
                channel.send(JSON.stringify({ type: "metadata", name: file.name, mimeType: file.type }));
                for (let i = 0; i < arrayBuffer.byteLength; i += CHUNK_SIZE) {
                    channel.send(arrayBuffer.slice(i, i + CHUNK_SIZE));
                }
            }
        });

        const playAtTimestamp = Date.now() + 3000; 
        socket.emit("media:play", { roomId, playAtTimestamp, mediaUrl: "webrtc-stream" });
    };

    // Return the LENGTH of the array so our UI still gets a clean number
    return { connectedPeers: connectedUsers.length, broadcastFile };
}