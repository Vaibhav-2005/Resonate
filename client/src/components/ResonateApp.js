"use client";
import { useState, useEffect } from "react";
import { useSocket } from "../hooks/useSocket";
import HostView from "./HostView";
import JoinForm from "./JoinForm";
import GuestView from "./GuestView";

export default function ResonateApp() {
    const { socket, isConnected } = useSocket();
    const [view, setView] = useState("home"); 
    const [roomId, setRoomId] = useState("");
    const [isHost, setIsHost] = useState(false);

    useEffect(() => {
        socket.on("room:user_joined", (data) => console.log("New friend joined!", data));
        return () => socket.off("room:user_joined");
    }, [socket]);

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
                // Show an alert if they type the wrong code!
                alert(response.message); 
            }
        });
    };

    return (
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
    );
}