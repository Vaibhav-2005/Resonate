"use client";

import { useEffect, useState, useCallback } from "react";
import { useSocket } from "./useSocket";
import { useSpotifyAuth } from "./useSpotifyAuth";
import { useSpotify } from "./useSpotify";
import { generateCodeVerifier, exchangeCodeForToken } from "../lib/spotify";
import { useRef, useInterval } from "react";

export function useRoom() {
    const { socket, isConnected, socketId } = useSocket();
    const { token, login, logout } = useSpotifyAuth();
    const { getPlayer, playTrack, pausePlayback, seekTrack, getDevices, searchTracks } = useSpotify();

    const [roomId, setRoomId] = useState("");
    const [isHost, setIsHost] = useState(false);
    const [view, setView] = useState("home");
    const [members, setMembers] = useState([]);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [myPositionMs, setMyPositionMs] = useState(0);
    const [clockOffset, setClockOffset] = useState(0);
    const [driftTimerRunning, setDriftTimerRunning] = useState(false);

    // Compute clock offset from sync:ping
    useEffect(() => {
        if (!socket) return;

        const handlePing = (event) => {
            const { clientRequestTime, serverReceiveTime, serverSendTime } = event;
            // Offset = server receive - client request time (simplified NTP)
            // client clock = server clock - offset
            const offset = serverReceiveTime - clientRequestTime;
            setClockOffset(offset);
        };

        socket.on('sync:ping', handlePing);

        return () => {
            socket.off('sync:ping', handlePing);
        };
    }, [socket]);

    // Drift correction: periodically re-anchor to host position
    useEffect(() => {
        if (!isHost || !socket || !token) return;

        const ANCHOR_INTERVAL = 3000; // 3 seconds

        const reportPlayer = async () => {
            try {
                const player = await getPlayer();
                if (player.isPlaying) {
                    socket.emit('player:report', {
                        roomId,
                        positionMs: player.position,
                        isPlaying: player.isPlaying
                    });
                }
            } catch (e) {
                console.error('Failed to report player position:', e);
            }
        };

        // Initial report, then interval
        const intervalId = setInterval(reportPlayer, ANCHOR_INTERVAL);
        reportPlayer(); // immediate first report

        return () => {
            clearInterval(intervalId);
        };
    }, [isHost, socket, token, getPlayer, roomId]);

    // Sync event handlers
    useEffect(() => {
        if (!socket) return;

        const handleSyncStart = (event) => {
            const { trackUri, anchorPositionMs, anchorServerTime, broadcastTime } = event;
            const latency = Date.now() - anchorServerTime;
            const correctedPosition = anchorPositionMs + latency;

            // Start playback on Spotify with corrected offset
            if (token) {
                playTrack(trackUri, correctedPosition).then(() => {
                    setCurrentTrack({ uri: trackUri, name: 'Loading...' });
                    setIsPlaying(true);
                }).catch(err => {
                    console.error('Failed to play track:', err);
                    // Surface premium requirement UX
                    if (err.message.includes('403') || err.status === 403) {
                        alert('Spotify Premium is required to control playback. Please open Spotify on your device and start playback manually.');
                    }
                });
            }
        };

        const handleSyncPause = (event) => {
            pausePlayback().then(() => setIsPlaying(false)).catch(err => console.error(err));
        };

        const handleSyncSeek = (event) => {
            const { anchorPositionMs, anchorServerTime } = event;
            const latency = Date.now() - anchorServerTime;
            const correctedPosition = anchorPositionMs + latency;
            seekTrack(correctedPosition).then(() => setMyPositionMs(correctedPosition)).catch(err => console.error(err));
        };

        const handleDrift = (event) => {
            const { positionMs, serverTime } = event;
            const latency = Date.now() - serverTime;
            const correctedTarget = positionMs + latency;

            // If our drift exceeds threshold, seek to corrected target
            if (Math.abs(myPositionMs - correctedTarget) > 500) {
                seekTrack(correctedTarget).then(() => setMyPositionMs(correctedTarget)).catch(err => console.error(err));
            }
        };

        const handleUserJoined = (event) => {
            // members update handled by roomService emit
        };

        const handleUserLeft = (event) => {
            // members update handled by roomService emit
        };

        socket.on('media:sync_start', handleSyncStart);
        socket.on('media:sync_pause', handleSyncPause);
        socket.on('media:sync_seek', handleSyncSeek);
        socket.on('media:drift', handleDrift);
        socket.on('room:user_joined', handleUserJoined);
        socket.on('room:user_left', handleUserLeft);

        return () => {
            socket.off('media:sync_start', handleSyncStart);
            socket.off('media:sync_pause', handleSyncPause);
            socket.off('media:sync_seek', handleSyncSeek);
            socket.off('media:drift', handleDrift);
            socket.off('room:user_joined', handleUserJoined);
            socket.off('room:user_left', handleUserLeft);
        };
    }, [socket, token, playTrack, pausePlayback, seekTrack, myPositionMs]);

    // Create room
    const handleCreateRoom = useCallback((name) => {
        const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        socket.emit('room:create', newRoomId, (response) => {
            if (response.success) {
                setRoomId(newRoomId);
                setIsHost(true);
                setView('hosting');
            }
        });
    }, [socket]);

    // Join room
    const handleJoinRoom = useCallback((code) => {
        socket.emit('room:join', code, (response) => {
            if (response.success) {
                setRoomId(code);
                setIsHost(false);
                setView('in-room');
            } else {
                alert(response.message);
            }
        });
    }, [socket]);

    // Leave room
    const handleLeaveRoom = useCallback(() => {
        socket.emit('room:leave', roomId);
        setRoomId('');
        setIsHost(false);
        setView('home');
        setCurrentTrack(null);
        setIsPlaying(false);
        setMyPositionMs(0);
    }, [roomId, socket]);

    // Track search
    const handleSearchTracks = useCallback(async (query) => {
        if (!token) return;
        const data = await searchTracks(query);
        setCurrentTrack(data.tracks.items[0] || null);
    }, [token]);

    // Periodic position polling for myPositionMs (drift detection baseline)
    useEffect(() => {
        if (!token || !isPlaying || !roomId) return;

        const INTERVAL = 2500;
        const tick = async () => {
            try {
                const player = await getPlayer();
                setMyPositionMs(player.position);
            } catch (e) {
                console.error('Failed to poll player position:', e);
            }
        };

        const id = setInterval(tick, INTERVAL);
        tick();

        return () => clearInterval(id);
    }, [token, isPlaying, roomId, getPlayer]);

    return {
        // State
        roomId, isHost, view, members, currentTrack, isPlaying, myPositionMs, clockOffset,
        // Actions
        login, logout, handleCreateRoom, handleJoinRoom, handleLeaveRoom, handleSearchTracks,
        // Derived
        canPlay: !!token && isConnected,
        isFullscreen: false
    };
}