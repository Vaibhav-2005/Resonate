export function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const base64 = btoa(String.fromCharCode.apply(null, array))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    return base64.substring(0, 43);
}

export function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = crypto.subtle.digest('SHA-256', data);
    return fetch(digest).then(d => d.arrayBuffer()).then(buf => {
        const b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
        return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    });
}

export function startSpotifyLogin(clientId, redirectUri) {
    const codeVerifier = generateCodeVerifier();
    sessionStorage.setItem('spotify_code_verifier', codeVerifier);

    generateCodeChallenge(codeVerifier).then(codeChallenge => {
        const scopes = [
            'user-read-playback-state',
            'user-modify-playback-state',
            'user-read-currently-playing',
            'streaming',
            'user-read-private'
        ].join(' ');

        const authorizeUrl = new URL('https://accounts.spotify.com/authorize');
        authorizeUrl.searchParams.set('client_id', clientId);
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('redirect_uri', redirectUri);
        authorizeUrl.searchParams.set('scope', scopes);
        authorizeUrl.searchParams.set('code_challenge', codeChallenge);
        authorizeUrl.searchParams.set('code_challenge_method', 'S256');

        window.location.href = authorizeUrl.toString();
    });
}

export function exchangeCodeForToken(codeVerifier) {
    return fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code_verifier: codeVerifier
        })
    }).then(res => res.json());
}

export function getToken() {
    return JSON.parse(localStorage.getItem('spotify_token'));
}

export function setToken(token) {
    localStorage.setItem('spotify_token', JSON.stringify(token));
}

export function clearToken() {
    localStorage.removeItem('spotify_token');
}

export function spotifyFetch(endpoint, options = {}) {
    const token = getToken();
    if (!token) throw new Error('No Spotify token');

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token.access_token}`
        }
    };

    if (options.method === 'GET') {
        const url = new URL(`https://api.spotify.com/v1${endpoint}`);
        return fetch(url, { ...defaultOptions, ...options });
    }

    const url = new URL(`https://api.spotify.com/v1${endpoint}`);
    return fetch(url, { ...defaultOptions, method: options.method, body: options.body });
}

export async function getPlayer() {
    return spotifyFetch('/me/player').then(res => {
        if (!res.ok) throw new Error('Failed to get player');
        return res.json();
    });
}

export async function playTrack(trackUri, positionMs = 0) {
    return spotifyFetch('/me/player/play', {
        method: 'PUT',
        body: JSON.stringify({ uris: [trackUri], position_ms: positionMs })
    }).then(res => {
        if (!res.ok) throw new Error('Failed to start playback');
        return res.json();
    });
}

export async function pausePlayback() {
    return spotifyFetch('/me/player/pause', {
        method: 'PUT'
    }).then(res => {
        if (!res.ok) throw new Error('Failed to pause');
        return res.json();
    });
}

export async function seekTrack(positionMs) {
    return spotifyFetch('/me/player/seek', {
        method: 'PUT',
        body: JSON.stringify({ position_ms: positionMs })
    }).then(res => {
        if (!res.ok) throw new Error('Failed to seek');
        return res.json();
    });
}

export async function getDevices() {
    return spotifyFetch('/me/player/devices').then(res => {
        if (!res.ok) throw new Error('Failed to get devices');
        return res.json();
    });
}

export async function searchTracks(query, limit = 5) {
    const encodedQuery = encodeURIComponent(query);
    return spotifyFetch(`/search?q=${encodedQuery}&type=track&limit=${limit}`).then(res => {
        if (!res.ok) throw new Error('Failed to search');
        return res.json();
    });
}