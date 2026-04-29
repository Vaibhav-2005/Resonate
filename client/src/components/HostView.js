"use client";
import { useState } from "react";
import QRCode from "react-qr-code";
import { useWebRTC } from "../hooks/useWebRTC"; // <-- Import the hook

// Add socket to the props here
export default function HostView({ roomId, socket }) {
    const [audioFile, setAudioFile] = useState(null);
    
    // Initialize the WebRTC engine
    const { connectedPeers, broadcastFile } = useWebRTC(socket, roomId);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file && (file.type.startsWith("audio/") || file.type.startsWith("video/"))) {
            setAudioFile(file);
        } else {
            alert("Please select a valid audio or video file.");
        }
    };

    // The function that triggers when you click the button
    const handleBroadcast = () => {
        if (!audioFile) return;
        console.log("Broadcasting to", connectedPeers, "peers...");
        broadcastFile(audioFile);
    };

    return (
        <div className="flex flex-col items-center gap-6 mt-4 p-8 bg-blue-50 rounded-3xl border border-blue-100 w-full">
            
            {/* Top Section: Room Info */}
            <div className="flex w-full justify-between items-start mb-2">
                <div>
                    <h2 className="text-sm text-blue-500 font-semibold uppercase tracking-wider">Party Code</h2>
                    <p className="text-4xl font-bold text-blue-700 tracking-widest">{roomId}</p>
                </div>
                <div className="bg-white p-2 rounded-xl shadow-sm border border-blue-100">
                    <QRCode value={`resonate://join?code=${roomId}`} size={80} fgColor="#2563eb" />
                </div>
            </div>

            <div className="w-full border-t border-blue-200"></div>

            {/* Middle Section: File Uploader */}
            <div className="w-full flex flex-col items-center gap-4 py-4">
                {!audioFile ? (
                    <>
                        <p className="text-slate-600 font-medium text-center">Select a track to broadcast</p>
                        <label className="cursor-pointer bg-white border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-all rounded-2xl p-8 w-full flex flex-col items-center justify-center text-blue-500 font-semibold group">
                            <span className="group-hover:scale-105 transition-transform">
                                + Choose Audio/Video File
                            </span>
                            <input type="file" accept="audio/*, video/*" className="hidden" onChange={handleFileSelect} />
                        </label>
                    </>
                ) : (
                    <div className="w-full bg-white border border-blue-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
                        <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Ready to play</p>
                        <p className="text-slate-700 font-medium truncate" title={audioFile.name}>
                            🎵 {audioFile.name}
                        </p>
                        <p className="text-sm text-slate-400">
                            {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <button onClick={() => setAudioFile(null)} className="text-sm text-red-400 hover:text-red-600 text-left mt-2">
                            Remove file
                        </button>
                    </div>
                )}
            </div>
            
            {/* Bottom Section: Status */}
            <div className="w-full pt-4 mt-2 border-t border-blue-200 text-center flex flex-col items-center">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    {/* Dynamically show how many people are connected over WebRTC */}
                    <p className="text-slate-500 text-sm">
                        {connectedPeers > 0 ? `${connectedPeers} device(s) ready to sync` : "Waiting for friends to join..."}
                    </p>
                </div>

                <button 
                    disabled={!audioFile || connectedPeers === 0}
                    onClick={handleBroadcast} // <-- ADDED THE ONCLICK HERE
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    BROADCAST & PLAY
                </button>
            </div>
        </div>
    );
}