// All Spotify API calls and auth utilities

const SPOTIFY_API = 'https://api.spotify.com/v1';
const TOKEN_KEY = 'spotify_token';

// ─── Token Storage ────────────────────────────────────────────────────────────

export function getToken() {
    return JSON.parse(localStorage.getItem(TOKEN_KEY));
}

export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

// ─── PKCE Auth Helpers ────────────────────────────────────────────────────────

export function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
        .substring(0, 43);
}

export async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function startSpotifyLogin(clientId, redirectUri) {
    const codeVerifier = generateCodeVerifier();
    sessionStorage.setItem('spotify_code_verifier', codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const scopes = [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'streaming',
        'user-read-private',
        'user-read-email',
        'playlist-read-private',
        'playlist-read-collaborative',
    ].join(' ');

    const url = new URL('https://accounts.spotify.com/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    window.location.href = url.toString();
}

export async function exchangeCodeForToken(code, codeVerifier) {
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const redirectUri = `${window.location.origin}/callback`;

    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            code_verifier: codeVerifier,
        }),
    });
    return res.json();
}

export async function refreshAccessToken(refreshToken) {
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;

    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
        }),
    });
    return res.json();
}

// ─── Authenticated Fetch ──────────────────────────────────────────────────────

export async function spotifyFetch(endpoint, options = {}) {
    const token = getToken();
    if (!token) throw new Error('No Spotify token');

    const res = await fetch(`${SPOTIFY_API}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token.access_token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    });

    // 204 No Content — valid empty response
    if (res.status === 204 || res.headers.get('content-length') === '0') return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
}

// ─── Player ───────────────────────────────────────────────────────────────────

export const getPlayer = () => spotifyFetch('/me/player');

export const getDevices = () => spotifyFetch('/me/player/devices');

export const transferPlayback = (deviceId) =>
    spotifyFetch('/me/player', {
        method: 'PUT',
        body: JSON.stringify({ device_ids: [deviceId], play: true }),
    });

export const playTrack = (trackUri, positionMs = 0, deviceId) =>
    spotifyFetch(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [trackUri], position_ms: positionMs }),
    });

export const playContext = (contextUri, offset = 0, positionMs = 0, deviceId) =>
    spotifyFetch(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, {
        method: 'PUT',
        body: JSON.stringify({ context_uri: contextUri, offset: { position: offset }, position_ms: positionMs }),
    });

export const pausePlayback = (deviceId) =>
    spotifyFetch(`/me/player/pause${deviceId ? `?device_id=${deviceId}` : ''}`, { method: 'PUT' });

export const resumePlayback = (deviceId) =>
    spotifyFetch(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, { method: 'PUT' });

export const seekTrack = (positionMs, deviceId) =>
    spotifyFetch(`/me/player/seek?position_ms=${positionMs}${deviceId ? `&device_id=${deviceId}` : ''}`, { method: 'PUT' });

export const nextTrack = (deviceId) =>
    spotifyFetch(`/me/player/next${deviceId ? `?device_id=${deviceId}` : ''}`, { method: 'POST' });

export const previousTrack = (deviceId) =>
    spotifyFetch(`/me/player/previous${deviceId ? `?device_id=${deviceId}` : ''}`, { method: 'POST' });

export const setVolume = (volumePercent, deviceId) =>
    spotifyFetch(`/me/player/volume?volume_percent=${volumePercent}${deviceId ? `&device_id=${deviceId}` : ''}`, { method: 'PUT' });

export const setShuffle = (state, deviceId) =>
    spotifyFetch(`/me/player/shuffle?state=${state}${deviceId ? `&device_id=${deviceId}` : ''}`, { method: 'PUT' });

export const setRepeat = (state, deviceId) =>
    spotifyFetch(`/me/player/repeat?state=${state}${deviceId ? `&device_id=${deviceId}` : ''}`, { method: 'PUT' });

// ─── Queue ────────────────────────────────────────────────────────────────────

export const getQueue = () => spotifyFetch('/me/player/queue');

export const addToQueue = (trackUri, deviceId) =>
    spotifyFetch(`/me/player/queue?uri=${encodeURIComponent(trackUri)}${deviceId ? `&device_id=${deviceId}` : ''}`, { method: 'POST' });

// ─── Playlists ────────────────────────────────────────────────────────────────

export const getUserPlaylists = (limit = 50) =>
    spotifyFetch(`/me/playlists?limit=${limit}`);

export const getPlaylistTracks = (playlistId, limit = 50) =>
    spotifyFetch(`/playlist/${playlistId}/tracks?limit=${limit}`);

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchTracks = (query, limit = 10) =>
    spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`);

// ─── User ─────────────────────────────────────────────────────────────────────

export const getCurrentUser = () => spotifyFetch('/me');