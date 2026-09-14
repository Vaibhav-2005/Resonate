"use client";

import { useEffect, useState, useCallback } from "react";
import { startSpotifyLogin, getToken, setToken, clearToken, refreshAccessToken } from "../lib/spotify";

export function useSpotifyAuth() {
    const [token, setTokenState] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const stored = getToken();
        if (stored) {
            if (stored.expires_at && Date.now() < stored.expires_at) {
                setTokenState(stored);
            } else if (stored.refresh_token) {
                // silently refresh on load if expired
                refreshAccessToken(stored.refresh_token).then(data => {
                    if (data.access_token) {
                        const updated = {
                            ...stored,
                            access_token: data.access_token,
                            expires_at: Date.now() + data.expires_in * 1000,
                            // refresh_token may or may not be returned
                            ...(data.refresh_token && { refresh_token: data.refresh_token }),
                        };
                        setToken(updated);
                        setTokenState(updated);
                    } else {
                        clearToken();
                    }
                }).catch(() => clearToken())
                  .finally(() => setIsLoading(false));
                return;
            } else {
                clearToken();
            }
        }
        setIsLoading(false);
    }, []);

    // Proactive refresh 5 minutes before expiry
    useEffect(() => {
        if (!token?.refresh_token || !token?.expires_at) return;
        const msUntilRefresh = token.expires_at - Date.now() - 5 * 60 * 1000;
        if (msUntilRefresh <= 0) return;

        const id = setTimeout(async () => {
            try {
                const data = await refreshAccessToken(token.refresh_token);
                if (data.access_token) {
                    const updated = {
                        ...token,
                        access_token: data.access_token,
                        expires_at: Date.now() + data.expires_in * 1000,
                        ...(data.refresh_token && { refresh_token: data.refresh_token }),
                    };
                    setToken(updated);
                    setTokenState(updated);
                }
            } catch (e) {
                console.error('Token refresh failed:', e);
            }
        }, msUntilRefresh);

        return () => clearTimeout(id);
    }, [token]);

    const login = useCallback(() => {
        const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
        const redirectUri = `${window.location.origin}/callback`;
        startSpotifyLogin(clientId, redirectUri);
    }, []);

    const logout = useCallback(() => {
        clearToken();
        setTokenState(null);
    }, []);

    return { token, isLoading, login, logout };
}