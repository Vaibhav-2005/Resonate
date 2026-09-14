"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSocket } from "./useSocket";
import { useSpotifyAuth } from "./useSpotifyAuth";
import { getCurrentUser } from "../lib/spotify";

export function useRoom() {
    const { socket, isConnected } = useSocket();
    const { token } = useSpotifyAuth();

    const [roomId, setRoomId] = useState("");
    const [isHost, setIsHost] = useState(false);
    const [view, setView] = useState("home");
    const [members, setMembers] = useState([]);
    const [clockOffset, setClockOffset] = useState(0);
    const displayNameRef = useRef(null);

    // ─── Fetch Spotify display name once on auth ──────────────────────────────
    useEffect(() => {
        if (!token) return;
        getCurrentUser()
            .then(user => { displayNameRef.current = user.display_name || "Guest"; })
            .catch(() => { displayNameRef.current = "Guest"; });
    }, [token]);

    // ─── Clock Sync ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const syncClock = () => {
            const clientRequestTime = Date.now();
            socket.emit("sync:ping", clientRequestTime, ({ serverReceiveTime, serverSendTime }) => {
                const clientReceiveTime = Date.now();
                const offset = ((serverReceiveTime - clientRequestTime) + (serverSendTime - clientReceiveTime)) / 2;
                setClockOffset(offset);
            });
        };

        // Sync immediately and every 30s
        syncClock();
        const id = setInterval(syncClock, 30000);
        return () => clearInterval(id);
    }, [socket]);

    // ─── Room Events ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const handleUserJoined = ({ members: updatedMembers }) => {
            setMembers(updatedMembers);
        };

        const handleUserLeft = ({ members: updatedMembers }) => {
            setMembers(updatedMembers);
        };

        const handleHostLeft = () => {
            setRoomId("");
            setIsHost(false);
            setView("home");
            setMembers([]);
        };

        socket.on("room:user_joined", handleUserJoined);
        socket.on("room:user_left", handleUserLeft);
        socket.on("room:host_left", handleHostLeft);

        return () => {
            socket.off("room:user_joined", handleUserJoined);
            socket.off("room:user_left", handleUserLeft);
            socket.off("room:host_left", handleHostLeft);
        };
    }, [socket]);

    // ─── Actions ──────────────────────────────────────────────────────────────
    const handleCreateRoom = useCallback(() => {
        if (!socket) return;
        const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        socket.emit("room:create", newRoomId, (response) => {
            if (response.success) {
                setRoomId(newRoomId);
                setIsHost(true);
                setView("hosting");
                setMembers([{ socketId: socket.id, isHost: true, displayName: displayNameRef.current }]);
            }
        });
    }, [socket]);

    const handleJoinRoom = useCallback((code) => {
        if (!socket) return;
        socket.emit("room:join", { roomId: code, displayName: displayNameRef.current }, (response) => {
            if (response.success) {
                setRoomId(code);
                setIsHost(false);
                setView("in-room");
                setMembers(response.members || []);
            } else {
                alert(response.message);
            }
        });
    }, [socket]);

    const handleLeaveRoom = useCallback(() => {
        if (!socket || !roomId) return;
        socket.emit("room:leave", roomId);
        setRoomId("");
        setIsHost(false);
        setView("home");
        setMembers([]);
    }, [socket, roomId]);

    return {
        roomId, isHost, view, setView,
        members, clockOffset,
        handleCreateRoom, handleJoinRoom, handleLeaveRoom,
        isConnected,
    };
}