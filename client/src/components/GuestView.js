"use client";
import { useWebRTC } from "../hooks/useWebRTC";

export default function GuestView({ roomId, socket }) {
    // We attach the exact same WebRTC brain to the guest!
    // It will hear the Offer, generate an Answer, and connect the pipes.
    const { connectedPeers } = useWebRTC(socket, roomId);

    return (
        <div className="flex flex-col items-center gap-6 p-8 bg-blue-50 rounded-3xl border border-blue-100 w-full text-center">
            
            {/* Pulsing indicator changes to solid green when WebRTC connects */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 transition-colors ${connectedPeers > 0 ? 'bg-green-100' : 'bg-blue-200 animate-pulse'}`}>
                <div className={`w-8 h-8 rounded-full ${connectedPeers > 0 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-700">
                {connectedPeers > 0 ? "Locked In!" : "Connecting..."}
            </h2>
            
            <p className="text-slate-500 font-medium">
                {connectedPeers > 0 
                    ? "Direct high-speed tunnel established. Waiting for host..." 
                    : "Establishing direct peer-to-peer connection..."}
            </p>
            
            <p className="text-xs font-mono text-blue-400 bg-blue-100 py-1 px-3 rounded-full mt-2">
                Room: {roomId}
            </p>
        </div>
    );
}