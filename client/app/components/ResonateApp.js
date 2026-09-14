"use client";

import { useSocket } from "../hooks/useSocket";
import { useRoom } from "../hooks/useRoom";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import SpotifyPlayerProvider from "./SpotifyPlayerProvider";
import AuthGate from "./AuthGate";
import HostView from "./HostView";
import GuestView from "./GuestView";
import JoinForm from "./JoinForm";

export default function ResonateApp() {
    const { socket, isConnected } = useSocket();
    const { token, login, logout } = useSpotifyAuth();
    const { roomId, isHost, view, setView, members,
    handleCreateRoom, handleJoinRoom, handleLeaveRoom } = useRoom();
    
    const handleLogout = () => {
        logout();
        handleLeaveRoom();
    };

    return (
        <AuthGate onLogin={login} onLogout={handleLogout}>
            <SpotifyPlayerProvider token={token}>
                <div className="w-full flex flex-col items-center">
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-blue-400' : 'bg-red-400'}`} />
                        <p className="text-sm text-slate-400">
                            {isConnected ? "Server Online" : "Connecting..."}
                        </p>
                    </div>

                    {view === "home" && (
                        <div className="flex flex-col gap-4 w-full">
                            <button onClick={handleCreateRoom} disabled={!isConnected}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-sm disabled:opacity-50">
                                Start a Party
                            </button>
                            <button onClick={() => setView("joining")} disabled={!isConnected}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50">
                                Join a Party
                            </button>
                        </div>
                    )}

                    {view === "joining" && (
                        <JoinForm onJoin={handleJoinRoom} onCancel={() => setView("home")} />
                    )}
                    {view === "hosting" && (
                        <HostView roomId={roomId} socket={socket} />
                    )}
                    {view === "in-room" && !isHost && (
                        <GuestView roomId={roomId} socket={socket} initialMembers={members} />
                    )}
                </div>
            </SpotifyPlayerProvider>
        </AuthGate>
    );
}