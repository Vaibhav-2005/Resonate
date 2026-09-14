"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { transferPlayback } from "../lib/spotify";

export function useSpotifyPlayer(token) {
    const [player, setPlayer] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [playerState, setPlayerState] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const playerRef = useRef(null);

    useEffect(() => {
        console.log("[SDK] useEffect fired, token:", token?.access_token ? "yes" : "no");
        if (!token?.access_token) return;

        // SDK calls this once it's loaded
        window.onSpotifyWebPlaybackSDKReady = () => {
            const spotifyPlayer = new window.Spotify.Player({
                name: "Resonate",
                getOAuthToken: (cb) => cb(token.access_token),
                volume: 0.8,
            });

            // Device is ready
            spotifyPlayer.addListener("ready", async ({ device_id }) => {
                console.log("[Spotify] Player ready, device:", device_id);
                setDeviceId(device_id);
                setIsReady(true);
                
                // Retry transfer up to 3 times with delay
                for (let i = 0; i < 3; i++) {
                    try {
                        await transferPlayback(device_id);
                        console.log("[Spotify] Playback transferred to browser");
                        break;
                    } catch (e) {
                        console.warn(`[Spotify] Transfer attempt ${i + 1} failed:`, e.status);
                        if (i < 2) await new Promise(r => setTimeout(r, 1000));
                    }
                }
            });

            // Device went offline
            spotifyPlayer.addListener("not_ready", ({ device_id }) => {
                console.log("[Spotify] Device offline:", device_id);
                setIsReady(false);
            });

            // Player state changed — fires automatically on play/pause/seek/track change
            spotifyPlayer.addListener("player_state_changed", (state) => {
                if (!state) return;
                setPlayerState(state);
            });

            spotifyPlayer.addListener("initialization_error", ({ message }) => {
                console.error("[Spotify] Init error:", message);
            });

            spotifyPlayer.addListener("authentication_error", ({ message }) => {
                console.error("[Spotify] Auth error:", message);
            });

            spotifyPlayer.addListener("account_error", ({ message }) => {
                console.error("[Spotify] Account error (Premium required):", message);
            });

            spotifyPlayer.connect();
            playerRef.current = spotifyPlayer;
            setPlayer(spotifyPlayer);
        };

        // Load the SDK script if not already loaded
        if (!document.getElementById("spotify-sdk")) {
            const script = document.createElement("script");
            script.id = "spotify-sdk";
            script.src = "https://sdk.scdn.co/spotify-player.js";
            script.async = true;
            document.body.appendChild(script);
        } else if (window.Spotify) {
            // SDK already loaded, fire manually
            window.onSpotifyWebPlaybackSDKReady();
        }

        return () => {
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
        };
    }, [token?.access_token]);

    // ─── Controls (operate on local SDK player, faster than API calls) ──────

    const play = useCallback(async () => {
        if (playerRef.current) await playerRef.current.resume();
    }, []);

    const pause = useCallback(async () => {
        if (playerRef.current) await playerRef.current.pause();
    }, []);

    const seek = useCallback(async (positionMs) => {
        if (playerRef.current) await playerRef.current.seek(positionMs);
    }, []);

    const setVolume = useCallback(async (fraction) => {
        // fraction: 0.0 to 1.0
        if (playerRef.current) await playerRef.current.setVolume(fraction);
    }, []);

    const nextTrack = useCallback(async () => {
        if (playerRef.current) await playerRef.current.nextTrack();
    }, []);

    const previousTrack = useCallback(async () => {
        if (playerRef.current) await playerRef.current.previousTrack();
    }, []);

    // Current track derived from playerState
    const currentTrack = playerState?.track_window?.current_track ?? null;
    const isPlaying = playerState ? !playerState.paused : false;
    const positionMs = playerState?.position ?? 0;
    const durationMs = playerState?.duration ?? 0;

    return {
        player: playerRef.current,
        deviceId,
        isReady,
        playerState,
        currentTrack,
        isPlaying,
        positionMs,
        durationMs,
        play,
        pause,
        seek,
        setVolume,
        nextTrack,
        previousTrack,
    };
}