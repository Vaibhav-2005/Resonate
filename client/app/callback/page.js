"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { exchangeCodeForToken, generateCodeVerifier, setToken, clearToken } from "../lib/spotify";

export default function CallbackPage() {
    const router = useRouter();
    const params = useSearchParams();
    const code = params.get('code');

    useEffect(() => {
        if (!code) {
            router.push('/');
            return;
        }

        // Get the code_verifier that was generated during login
        const codeVerifier = sessionStorage.getItem('spotify_code_verifier');

        if (!codeVerifier) {
            clearToken();
            router.push('/');
            return;
        }

        exchangeCodeForToken(codeVerifier).then(data => {
            if (data.access_token) {
                const expiresAt = Date.now() + data.expires_in * 1000;
                setToken({ ...data, expires_at: expiresAt });
                sessionStorage.removeItem('spotify_code_verifier');
                router.push('/');
            } else {
                clearToken();
                router.push('/');
            }
        }).catch(() => {
            clearToken();
            router.push('/');
        });
    }, [router]);

    return null;
}