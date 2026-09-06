"use client";

import { useEffect, useState } from "react";
import { 
    startSpotifyLogin, 
    getToken, 
    setToken, 
    clearToken, 
    spotifyFetch 
} from "../lib/spotify";

export function useSpotifyAuth() {
    const [token, setTokenState] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem('spotify_token'));
        if (stored) {
            const expiresAt = stored.expires_at ? new Date(stored.expires_at) : null;
            const isValid = !expiresAt || expiresAt > new Date();
            if (isValid) {
                setTokenState(stored);
            } else {
                clearToken();
            }
        }
        setIsLoading(false);
    }, []);

    const login = () => {
        const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
        const redirectUri = `${window.location.origin}/callback`;
        startSpotifyLogin(clientId, redirectUri);
    };

    const logout = () => {
        clearToken();
        setTokenState(null);
    };

    return { token, isLoading, login, logout };
}