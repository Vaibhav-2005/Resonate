"use client";

import {
    getPlayer as _getPlayer,
    getDevices as _getDevices,
    transferPlayback as _transferPlayback,
    playTrack as _playTrack,
    playContext as _playContext,
    pausePlayback as _pausePlayback,
    resumePlayback as _resumePlayback,
    seekTrack as _seekTrack,
    nextTrack as _nextTrack,
    previousTrack as _previousTrack,
    setVolume as _setVolume,
    setShuffle as _setShuffle,
    setRepeat as _setRepeat,
    getQueue as _getQueue,
    addToQueue as _addToQueue,
    getUserPlaylists as _getUserPlaylists,
    getPlaylistTracks as _getPlaylistTracks,
    searchTracks as _searchTracks,
    getCurrentUser as _getCurrentUser,
} from "../lib/spotify";

export function useSpotify() {
    return {
        getPlayer: _getPlayer,
        getDevices: _getDevices,
        transferPlayback: _transferPlayback,
        playTrack: _playTrack,
        playContext: _playContext,
        pausePlayback: _pausePlayback,
        resumePlayback: _resumePlayback,
        seekTrack: _seekTrack,
        nextTrack: _nextTrack,
        previousTrack: _previousTrack,
        setVolume: _setVolume,
        setShuffle: _setShuffle,
        setRepeat: _setRepeat,
        getQueue: _getQueue,
        addToQueue: _addToQueue,
        getUserPlaylists: _getUserPlaylists,
        getPlaylistTracks: _getPlaylistTracks,
        searchTracks: _searchTracks,
        getCurrentUser: _getCurrentUser,
    };
}