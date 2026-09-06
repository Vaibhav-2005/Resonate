"use client";

import { playTrack, pausePlayback, seekTrack, getPlayer, getDevices, searchTracks } from "../lib/spotify";

export function useSpotify() {
    const getPlayer = async () => {
        return await getPlayer();
    };

    const playTrack = async (trackUri, positionMs = 0) => {
        return await playTrack(trackUri, positionMs);
    };

    const pausePlayback = async () => {
        return await pausePlayback();
    };

    const seekTrack = async (positionMs) => {
        return await seekTrack(positionMs);
    };

    const getDevices = async () => {
        return await getDevices();
    };

    const searchTracks = async (query, limit = 5) => {
        return await searchTracks(query, limit);
    };

    return { getPlayer, playTrack, pausePlayback, seekTrack, getDevices, searchTracks };
}