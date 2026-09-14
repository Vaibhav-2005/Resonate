"use client";

import { createContext, useContext } from "react";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";

const SpotifyPlayerContext = createContext(null);

export function usePlayerContext() {
    return useContext(SpotifyPlayerContext);
}

export default function SpotifyPlayerProvider({ token, children }) {
    console.log("[Provider] token received:", token?.access_token ? "yes" : "no");
    const playerData = useSpotifyPlayer(token);

    return (
        <SpotifyPlayerContext.Provider value={playerData}>
            {children}
        </SpotifyPlayerContext.Provider>
    );
}