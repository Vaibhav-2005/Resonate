"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { exchangeCodeForToken, setToken, clearToken } from "../lib/spotify";

export default function CallbackPage() {
    const router = useRouter();
    const params = useSearchParams();
    const code = params.get('code');

    useEffect(() => {
        if (!code) {
            router.push('/');
            return;
        }

        const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
        if (!codeVerifier) {
            clearToken();
            router.push('/');
            return;
        }

        exchangeCodeForToken(code, codeVerifier)
            .then(data => {
                if (data.access_token) {
                    setToken({
                        ...data,
                        expires_at: Date.now() + data.expires_in * 1000,
                    });
                    sessionStorage.removeItem('spotify_code_verifier');
                } else {
                    clearToken();
                }
                router.push('/');
            })
            .catch(() => {
                clearToken();
                router.push('/');
            });
    }, [code, router]);

    return null;
}