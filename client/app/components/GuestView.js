"use client";

import { useEffect, useState } from "react";
import { usePlayerContext } from "./SpotifyPlayerProvider";
import { playTrack, seekTrack, pausePlayback, resumePlayback, getQueue } from "../lib/spotify";

export default function GuestView({ roomId, socket, initialMembers = [] }) {
    
    const playerContext = usePlayerContext();

    if (!playerContext) return (
        <div className="flex flex-col items-center gap-4 p-8 w-full text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 animate-pulse" />
            <p className="text-slate-500">Initializing player...</p>
        </div>
    );
    
    const { deviceId, isReady, currentTrack, isPlaying, positionMs, durationMs, player } = usePlayerContext();

    const [members, setMembers] = useState([]);
    const [queue, setQueue] = useState([]);
    const [syncStatus, setSyncStatus] = useState("connecting"); // connecting | synced | syncing

    // fetch queue on mount and when track changes
    useEffect(() => {
        if (!currentTrack) return;
        getQueue()
            .then(data => setQueue(data?.queue || []))
            .catch(() => {});
    }, [currentTrack?.id]);

    // sync initial members if passed after mount
    useEffect(() => {
        if (initialMembers.length > 0) setMembers(initialMembers);
    }, [initialMembers]);
    
    // ─── Room member events ───────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onUserJoined = ({ members: m }) => setMembers(m);
        const onUserLeft = ({ members: m }) => setMembers(m);

        socket.on("room:user_joined", onUserJoined);
        socket.on("room:user_left", onUserLeft);

        return () => {
            socket.off("room:user_joined", onUserJoined);
            socket.off("room:user_left", onUserLeft);
        };
    }, [socket]);

    // ─── Sync event handlers ──────────────────────────────────────────────────
    useEffect(() => {
        if (!socket || !deviceId) return;

        const handleSyncStart = async ({ trackUri, anchorPositionMs, anchorServerTime }) => {
            setSyncStatus("syncing");
            try {
                // Start playback first
                await playTrack(trackUri, anchorPositionMs, deviceId);
                
                // Wait for SDK to confirm playback, then correct position
                setTimeout(async () => {
                    const correctedPosition = anchorPositionMs + (Date.now() - anchorServerTime);
                    try {
                        await seekTrack(correctedPosition, deviceId);
                        setSyncStatus("synced");
                    } catch (e) {
                        setSyncStatus("synced"); // still mark synced even if seek fails
                    }
                }, 1500); // wait for playback to stabilize
            } catch (e) {
                console.error("[Guest] Failed to sync play:", e);
                setSyncStatus("connecting");
            }
        };

        const handleSyncPause = async () => {
            setSyncStatus("syncing");
            try {
                await pausePlayback(deviceId);
                setSyncStatus("synced");
            } catch (e) {
                console.error("[Guest] Failed to sync pause:", e);
            }
        };

        const handleSyncSeek = async ({ anchorPositionMs, anchorServerTime }) => {
            const latency = Date.now() - anchorServerTime;
            const correctedPosition = anchorPositionMs + latency;
            try {
                await seekTrack(correctedPosition, deviceId);
            } catch (e) {
                console.error("[Guest] Failed to sync seek:", e);
            }
        };

        const handleDrift = async ({ positionMs: hostPosition, serverTime }) => {
            const latency = Date.now() - serverTime;
            const correctedTarget = hostPosition + latency;
            console.log(`[Drift] guest=${positionMs} target=${correctedTarget} diff=${Math.abs(positionMs - correctedTarget)}`);
            if (Math.abs(positionMs - correctedTarget) > 500) {
                try {
                    await seekTrack(correctedTarget, deviceId);
                } catch (e) {}
            }
        };

        const handleHostLeft = () => {
            setSyncStatus("connecting");
            pausePlayback(deviceId).catch(() => {});
        };

        socket.on("media:sync_start", handleSyncStart);
        socket.on("media:sync_pause", handleSyncPause);
        socket.on("media:sync_seek", handleSyncSeek);
        socket.on("media:drift", handleDrift);
        socket.on("room:host_left", handleHostLeft);

        return () => {
            socket.off("media:sync_start", handleSyncStart);
            socket.off("media:sync_pause", handleSyncPause);
            socket.off("media:sync_seek", handleSyncSeek);
            socket.off("media:drift", handleDrift);
            socket.off("room:host_left", handleHostLeft);
        };
    }, [socket, deviceId, positionMs]);

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const formatMs = (ms) => {
        const s = Math.floor(ms / 1000);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    };

    const albumArt = currentTrack?.album?.images?.[0]?.url;

    const statusConfig = {
        connecting: { color: "bg-blue-200 animate-pulse", dot: "bg-blue-500", label: "Connecting..." },
        syncing:    { color: "bg-yellow-100",              dot: "bg-yellow-400", label: "Syncing..."    },
        synced:     { color: "bg-green-100",               dot: "bg-green-500",  label: "In sync"       },
    }[syncStatus];

    // ─── Render ───────────────────────────────────────────────────────────────
    if (!isReady) {
        return (
            <div className="flex flex-col items-center gap-4 p-8 w-full text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 animate-pulse" />
                <p className="text-slate-500">Connecting to Spotify...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 w-full max-w-md">

            {/* ── Status ── */}
            <div className={`flex items-center justify-center gap-3 p-4 rounded-2xl border border-blue-100 ${statusConfig.color} transition-all`}>
                <div className={`w-3 h-3 rounded-full ${statusConfig.dot}`} />
                <p className="text-sm font-semibold text-slate-700">{statusConfig.label}</p>
            </div>

            {/* ── Now Playing ── */}
            <div className="bg-blue-50 rounded-3xl border border-blue-100 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    {albumArt
                        ? <img src={albumArt} alt="album" className="w-16 h-16 rounded-xl object-cover shadow" />
                        : <div className="w-16 h-16 rounded-xl bg-blue-200" />
                    }
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">
                            {currentTrack?.name || "Waiting for host..."}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                            {currentTrack?.artists?.map(a => a.name).join(", ") || "—"}
                        </p>
                    </div>
                </div>

                {/* Progress bar — read only for guests */}
                <div className="flex flex-col gap-1">
                    <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: durationMs ? `${(positionMs / durationMs) * 100}%` : "0%" }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>{formatMs(positionMs)}</span>
                        <span>{formatMs(durationMs)}</span>
                    </div>
                </div>
            </div>

            {/* ── Queue ── */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col gap-2">
                <p className="text-sm font-semibold text-slate-600 mb-1">Up next</p>
                {queue.length === 0
                    ? <p className="text-slate-400 text-sm text-center py-2">Queue is empty</p>
                    : queue.slice(0, 5).map((track, i) => (
                        <div key={`${track.id}-${i}`} className="flex items-center gap-3">
                            {track.album?.images?.[0]?.url
                                ? <img src={track.album.images[0].url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                                : <div className="w-8 h-8 rounded-lg bg-blue-200 flex-shrink-0" />
                            }
                            <div className="min-w-0">
                                <p className="text-sm text-slate-700 truncate">{track.name}</p>
                                <p className="text-xs text-slate-400 truncate">{track.artists?.map(a => a.name).join(", ")}</p>
                            </div>
                        </div>
                    ))
                }
            </div>

            {/* ── Members ── */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <p className="text-sm font-semibold text-slate-600 mb-2">
                    {members.length} in the party
                </p>
                <div className="flex flex-wrap gap-2">
                    {members.map(m => (
                        <span key={m.socketId}
                            className="text-xs bg-white border border-blue-100 text-slate-600 px-3 py-1 rounded-full">
                            {m.displayName || "Guest"} {m.isHost && "👑"}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── Room Code ── */}
            <p className="text-xs font-mono text-blue-400 bg-blue-50 border border-blue-100 py-2 px-4 rounded-full text-center">
                Room: {roomId}
            </p>

        </div>
    );
}