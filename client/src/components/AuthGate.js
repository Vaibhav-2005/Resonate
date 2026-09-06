"use client";

import { useEffect, useState } from "react";

export default function AuthGate({ children, onLogin }) {
    const [hasToken, setHasToken] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('spotify_token');
        setHasToken(!!stored);
    }, []);

    const login = () => {
        onLogin();
    };

    if (!hasToken) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="bg-blue-50 rounded-3xl border border-blue-100 p-8 w-full max-w-md text-center">
                    <h2 className="text-2xl font-bold text-blue-600 mb-4">Resonate</h2>
                    <p className="text-slate-600 mb-8">
                        Connect your Spotify account to sync playback across devices.
                    </p>
                    <button
                        onClick={login}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-sm"
                    >
                        Login with Spotify
                    </button>
                </div>
            </div>
        );
    }

    return children;
}