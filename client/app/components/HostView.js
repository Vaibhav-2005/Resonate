"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "react-qr-code";
import { usePlayerContext } from "./SpotifyPlayerProvider";
import {
    playTrack, playContext, pausePlayback, resumePlayback,
    seekTrack, nextTrack, previousTrack, setVolume as apiSetVolume,
    setShuffle, setRepeat, getQueue, addToQueue,
    getUserPlaylists, getPlaylistTracks, searchTracks,
} from "../lib/spotify";

export default function HostView({ roomId, socket }) {

    const playerContext = usePlayerContext();

    if (!playerContext) return (
        <div className="flex flex-col items-center gap-4 p-8 w-full text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 animate-pulse" />
            <p className="text-slate-500">Initializing player...</p>
        </div>
    );

    const {
        deviceId, isReady, currentTrack, isPlaying,
        positionMs, durationMs, playerState,
        pause, play, seek, setVolume, nextTrack: sdkNext, previousTrack: sdkPrev,
    } = usePlayerContext();

    // ─── UI State ─────────────────────────────────────────────────────────────
    const [members, setMembers] = useState([]);
    const [queue, setQueue] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [playlistTracks, setPlaylistTracks] = useState([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [volume, setVolumeState] = useState(80);
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekValue, setSeekValue] = useState(0);
    const [shuffle, setShuffleState] = useState(false);
    const [repeat, setRepeatState] = useState("off"); // off, track, context
    const [tab, setTab] = useState("queue"); // queue, playlists, search
    const [showQR, setShowQR] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const searchTimeout = useRef(null);

    const joinUrl = `${window.location.origin}?join=${roomId}`;

    // ─── Fetch playlists and queue on mount ───────────────────────────────────
    useEffect(() => {
        getUserPlaylists().then(data => setPlaylists(data?.items || [])).catch(() => {});
        refreshQueue();
    }, []);

    const refreshQueue = async () => {
        try {
            const data = await getQueue();
            setQueue(data?.queue || []);
        } catch (e) {}
    };

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

    // ─── Sync playerState changes to guests ──────────────────────────────────
    useEffect(() => {
        if (!socket || !playerState || !roomId) return;

        // Update seek bar passively
        if (!isSeeking) setSeekValue(positionMs);

        // Sync shuffle/repeat state from SDK
        setShuffleState(playerState.shuffle);
        setRepeatState(playerState.repeat_mode === 0 ? "off" : playerState.repeat_mode === 1 ? "context" : "track");

        // Refresh queue when track changes
        refreshQueue();
    }, [playerState]);

    // ─── Broadcast play to guests when SDK fires play ─────────────────────────
    useEffect(() => {
        if (!socket || !currentTrack || !roomId) return;

        if (isPlaying) {
            socket.emit("media:control", {
                roomId,
                action: "play",
                trackUri: currentTrack.uri,
                positionMs,
            });
        } else {
            socket.emit("media:control", { roomId, action: "pause", positionMs });
        }
    }, [isPlaying]);

    // ─── Controls ─────────────────────────────────────────────────────────────
    const handlePlayPause = async () => {
        if (isPlaying) {
            await pause();
            socket.emit("media:control", { roomId, action: "pause", positionMs });
        } else {
            await play();
            socket.emit("media:control", { roomId, action: "play", trackUri: currentTrack?.uri, positionMs });
        }
    };

    const handleNext = async () => {
        await sdkNext();
        setTimeout(() => {
            socket.emit("media:control", { roomId, action: "play", trackUri: currentTrack?.uri, positionMs: 0 });
            refreshQueue();
        }, 500); // small delay for SDK to update state
    };

    const handlePrev = async () => {
        await sdkPrev();
        setTimeout(() => {
            socket.emit("media:control", { roomId, action: "play", trackUri: currentTrack?.uri, positionMs: 0 });
        }, 500);
    };

    const handleSeekStart = () => setIsSeeking(true);

    const handleSeekChange = (e) => setSeekValue(Number(e.target.value));

    const handleSeekEnd = async (e) => {
        const ms = Number(e.target.value);
        setIsSeeking(false);
        await seek(ms);
        socket.emit("media:control", { roomId, action: "seek", positionMs: ms });
    };

    const handleVolume = async (e) => {
        const val = Number(e.target.value);
        setVolumeState(val);
        await setVolume(val / 100);
    };

    const handleShuffle = async () => {
        const next = !shuffle;
        setShuffleState(next);
        await setShuffle(next, deviceId);
    };

    const handleRepeat = async () => {
        const modes = ["off", "context", "track"];
        const next = modes[(modes.indexOf(repeat) + 1) % modes.length];
        setRepeatState(next);
        await setRepeat(next, deviceId);
    };

    // ─── Playlist ─────────────────────────────────────────────────────────────
    const handleSelectPlaylist = async (playlist) => {
        setSelectedPlaylist(playlist);
        try {
            const data = await getPlaylistTracks(playlist.id);
            setPlaylistTracks(data?.items?.map(i => i.track).filter(Boolean) || []);
        } catch (e) {}
    };

    const handlePlayFromPlaylist = async (track, index) => {
        await playContext(selectedPlaylist.uri, index, 0, deviceId);
        socket.emit("media:control", { roomId, action: "play", trackUri: track.uri, positionMs: 0 });
    };

    // ─── Queue ────────────────────────────────────────────────────────────────
    const handleAddToQueue = async (track) => {
        await addToQueue(track.uri, deviceId);
        await refreshQueue();
    };

    // ─── Search ───────────────────────────────────────────────────────────────
    const handleSearch = (e) => {
        const q = e.target.value;
        setSearchQuery(q);
        clearTimeout(searchTimeout.current);
        if (!q.trim()) { setSearchResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            try {
                const data = await searchTracks(q, 10);
                setSearchResults(data?.tracks?.items || []);
            } catch (e) {}
        }, 400);
    };

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const formatMs = (ms) => {
        const s = Math.floor(ms / 1000);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    };

    const albumArt = currentTrack?.album?.images?.[0]?.url;

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

            {/* ── Now Playing ── */}
            <div className="bg-blue-50 rounded-3xl border border-blue-100 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    {albumArt
                        ? <img src={albumArt} alt="album" className="w-16 h-16 rounded-xl object-cover shadow" />
                        : <div className="w-16 h-16 rounded-xl bg-blue-200" />
                    }
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">
                            {currentTrack?.name || "Nothing playing"}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                            {currentTrack?.artists?.map(a => a.name).join(", ") || "—"}
                        </p>
                    </div>
                </div>

                {/* Seek Bar */}
                <div className="flex flex-col gap-1">
                    <input
                        type="range" min={0} max={durationMs || 1}
                        value={isSeeking ? seekValue : positionMs}
                        onMouseDown={handleSeekStart}
                        onTouchStart={handleSeekStart}
                        onChange={handleSeekChange}
                        onMouseUp={handleSeekEnd}
                        onTouchEnd={handleSeekEnd}
                        className="w-full accent-blue-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>{formatMs(isSeeking ? seekValue : positionMs)}</span>
                        <span>{formatMs(durationMs)}</span>
                    </div>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center justify-between">
                    <button onClick={handleShuffle}
                        className={`text-xl ${shuffle ? "text-blue-600" : "text-slate-400"}`}>
                        ⇄
                    </button>
                    <button onClick={handlePrev} className="text-2xl text-slate-700">⏮</button>
                    <button onClick={handlePlayPause}
                        className="bg-blue-600 hover:bg-blue-700 text-white w-12 h-12 rounded-full text-xl flex items-center justify-center shadow transition-all">
                        {isPlaying ? "⏸" : "▶"}
                    </button>
                    <button onClick={handleNext} className="text-2xl text-slate-700">⏭</button>
                    <button onClick={handleRepeat}
                        className={`text-xl ${repeat !== "off" ? "text-blue-600" : "text-slate-400"}`}>
                        {repeat === "track" ? "🔂" : "🔁"}
                    </button>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm">🔈</span>
                    <input type="range" min={0} max={100} value={volume}
                        onChange={handleVolume}
                        className="flex-1 accent-blue-600 cursor-pointer" />
                    <span className="text-slate-400 text-sm">🔊</span>
                </div>
            </div>

            {/* ── Room Info Row ── */}
            <div className="flex gap-2">
                <div className="flex-1 bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
                    <p className="text-xs text-slate-400 mb-1">Room Code</p>
                    <p className="text-3xl font-bold text-blue-600 tracking-widest">{roomId}</p>
                </div>
                <button onClick={() => setShowQR(v => !v)}
                    className="bg-blue-50 border border-blue-100 rounded-2xl px-4 text-blue-600 font-semibold text-sm">
                    {showQR ? "Hide QR" : "QR Code"}
                </button>
                <button onClick={() => setShowMembers(v => !v)}
                    className="bg-blue-50 border border-blue-100 rounded-2xl px-4 text-blue-600 font-semibold text-sm">
                    👥 {members.length}
                </button>
            </div>

            {/* QR Code */}
            {showQR && (
                <div className="bg-white border border-blue-100 rounded-2xl p-6 flex flex-col items-center gap-3">
                    <QRCode value={joinUrl} size={180} />
                    <p className="text-xs text-slate-400 break-all text-center">{joinUrl}</p>
                </div>
            )}

            {/* Members List */}
            {showMembers && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col gap-2">
                    <p className="text-sm font-semibold text-slate-600 mb-1">In the party</p>
                    {members.map(m => (
                        <div key={m.socketId} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                            <span className="text-sm text-slate-700">
                                {m.displayName || "Guest"} {m.isHost && <span className="text-xs text-blue-400">(host)</span>}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-blue-50 border border-blue-100 rounded-2xl p-1">
                {["queue", "playlists", "search"].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-all
                            ${tab === t ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}>
                        {t}
                    </button>
                ))}
            </div>

            {/* Queue Tab */}
            {tab === "queue" && (
                <div className="flex flex-col gap-2">
                    {queue.length === 0
                        ? <p className="text-slate-400 text-sm text-center py-4">Queue is empty</p>
                        : queue.map((track, i) => (
                            <TrackRow key={`${track.id}-${i}`} track={track} />
                        ))
                    }
                </div>
            )}

            {/* Playlists Tab */}
            {tab === "playlists" && (
                <div className="flex flex-col gap-2">
                    {!selectedPlaylist
                        ? playlists.map(pl => (
                            <button key={pl.id} onClick={() => handleSelectPlaylist(pl)}
                                className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-2xl hover:bg-blue-100 transition-all text-left">
                                {pl.images?.[0]?.url
                                    ? <img src={pl.images[0].url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                    : <div className="w-10 h-10 rounded-lg bg-blue-200" />
                                }
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-700 truncate text-sm">{pl.name}</p>
                                    <p className="text-xs text-slate-400">{pl.tracks?.total} tracks</p>
                                </div>
                            </button>
                        ))
                        : (
                            <>
                                <button onClick={() => { setSelectedPlaylist(null); setPlaylistTracks([]); }}
                                    className="text-blue-600 text-sm font-semibold text-left mb-1">
                                    ← Back to playlists
                                </button>
                                <p className="font-semibold text-slate-700 text-sm mb-1">{selectedPlaylist.name}</p>
                                {playlistTracks.map((track, i) => (
                                    <TrackRow key={`${track.id}-${i}`} track={track}
                                        onPlay={() => handlePlayFromPlaylist(track, i)}
                                        onAddToQueue={() => handleAddToQueue(track)}
                                    />
                                ))}
                            </>
                        )
                    }
                </div>
            )}

            {/* Search Tab */}
            {tab === "search" && (
                <div className="flex flex-col gap-3">
                    <input
                        type="text" value={searchQuery} onChange={handleSearch}
                        placeholder="Search songs, artists..."
                        className="w-full p-3 border-2 border-blue-100 rounded-xl focus:outline-none focus:border-blue-400 text-slate-700 text-sm"
                    />
                    {searchResults.map((track, i) => (
                        <TrackRow key={`${track.id}-${i}`} track={track}
                            onPlay={async () => {
                                await playTrack(track.uri, 0, deviceId);
                                socket.emit("media:control", { roomId, action: "play", trackUri: track.uri, positionMs: 0 });
                            }}
                            onAddToQueue={() => handleAddToQueue(track)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Reusable Track Row ───────────────────────────────────────────────────────
function TrackRow({ track, onPlay, onAddToQueue }) {
    return (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-2xl">
            {track.album?.images?.[0]?.url
                ? <img src={track.album.images[0].url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-10 h-10 rounded-lg bg-blue-200 flex-shrink-0" />
            }
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-700 truncate text-sm">{track.name}</p>
                <p className="text-xs text-slate-400 truncate">{track.artists?.map(a => a.name).join(", ")}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
                {onPlay && (
                    <button onClick={onPlay}
                        className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all">
                        Play
                    </button>
                )}
                {onAddToQueue && (
                    <button onClick={onAddToQueue}
                        className="bg-blue-100 text-blue-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-all">
                        + Queue
                    </button>
                )}
            </div>
        </div>
    );
}