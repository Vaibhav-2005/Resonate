"use client";

import { useState, useEffect } from "react";
import { useSocket } from "../hooks/useSocket";
import { useRoom } from "../hooks/useRoom";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import AuthGate from "./AuthGate";
import HostView from "./HostView";
import GuestView from "./GuestView";
import JoinForm from "./JoinForm";

export default function ResonateApp() {
    const { socket, isConnected } = useSocket();
    const { token, login: spotifyLogin, logout } = useSpotifyAuth();
    const { roomId, isHost, view, members, currentTrack, isPlaying, myPositionMs, clockOffset } = useRoom();

    useEffect(() => {
        if (view === "home") {
            setRoomId("");
            setIsHost(false);
        }
    }, [view]);

    useEffect(() => {
        // When auth state changes, update room view
        if (!token && view !== "home") {
            setView("home");
            setRoomId("");
            setIsHost(false);
        }
    }, [token, view]);

    const handleCreateRoom = () => {
        const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        socket.emit("room:create", newRoomId, (response) => {
            if (response.success) {
                setRoomId(newRoomId);
                setIsHost(true);
                setView("hosting");
            }
        });
    };

    const handleJoinRoom = (code) => {
        socket.emit("room:join", code, (response) => {
            if (response.success) {
                setRoomId(code);
                setIsHost(false);
                setView("in-room");
            } else {
                alert(response.message);
            }
        });
    };

    const handleLeaveRoom = () => {
        socket.emit("room:leave", roomId);
        setRoomId("");
        setIsHost(false);
        setView("home");
    };

    const handleLogin = () => {
        spotifyLogin();
    };

    const handleLogout = () => {
        logout();
        handleLeaveRoom();
    };

    // When token becomes available and we're in home view, auto-join or show UI
    useEffect(() => {
        if (token && view === "home" && !roomId) {
            // Could auto-create or show options - for now stay on home
        }
    }, [token, view, roomId]);

    return (
        <AuthGate onLogin={handleLogin} onLogout={handleLogout}>
            {token ? (
                <div className="w-full flex flex-col items-center">
                    {/* Connection Status */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-blue-400' : 'bg-red-400'}`}></div>
                        <p className="text-sm text-slate-400">
                            {isConnected ? "Server Online" : "Connecting..."}
                        </p>
                    </div>

                    {/* View Routing Logic */}
                    {view === "home" && (
                        <div className="flex flex-col gap-4 w-full">
                            <button
                                onClick={handleCreateRoom} disabled={!isConnected}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-sm disabled:opacity-50"
                            >
                                Start a Party
                            </button>
                            <button
                                onClick={() => setView("joining")} disabled={!isConnected}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50"
                            >
                                Join a Party
                            </button>
                        </div>
                    )}

                    {view === "joining" && <JoinForm onJoin={handleJoinRoom} onCancel={() => setView("home")} />}

                    {view === "hosting" && <HostView roomId={roomId} socket={socket} />}

                    {view === "in-room" && !isHost && <GuestView roomId={roomId} socket={socket} />}
                </div>
            ) : (
                <div className="min-h-screen flex items-center justify-center bg-white">
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-blue-600 tracking-widest mb-2">RESONATE</h1>
                        <p className="text-slate-600">Connect your Spotify account to begin</p>
                    </div>
                </div>
            )}
        </AuthGate>
    );
}