import { useUser, useAuth } from "@clerk/clerk-react";
import { useMemo, useCallback } from "react";

export type ClerkUserTier = "pro" | "community" | "free" | "executive";

export type WamUserRole = "Pro" | "Community" | "Guest";

interface CirclesMetadata {
    circles?: {
        tier: ClerkUserTier;
        status: "active" | "past_due" | "canceled" | "unpaid" | "paused";
        role?: "admin" | "user";
    };
}

export const useClerkAuth = () => {
    const { isLoaded, isSignedIn, user } = useUser();
    const { getToken } = useAuth();

    const tier = useMemo((): ClerkUserTier => {
        if (!user) return "free";
        const metadata = user.publicMetadata as CirclesMetadata;
        return metadata?.circles?.tier || "free";
    }, [user]);

    const role = useMemo((): WamUserRole => {
        if (tier === "pro" || tier === "executive") return "Pro";
        if (tier === "community") return "Community";
        return "Guest";
    }, [tier]);

    const isAdmin = useMemo((): boolean => {
        if (!user) return false;
        const metadata = user.publicMetadata as CirclesMetadata;
        return metadata?.circles?.role === "admin";
    }, [user]);

    const isAuthenticated = isSignedIn ?? false;

    const fetchWithAuth = useCallback(
        async (url: string, options: RequestInit = {}) => {
            const token = await getToken();
            const headers = new Headers(options.headers);
            if (token) {
                headers.set("Authorization", `Bearer ${token}`);
            }
            return fetch(url, { ...options, headers });
        },
        [getToken]
    );

    return {
        isLoading: !isLoaded,
        isAuthenticated,
        user: user
            ? {
                id: user.id,
                email: user.primaryEmailAddress?.emailAddress || null,
                name: user.fullName || user.firstName || null,
                imageUrl: user.imageUrl,
            }
            : null,
        tier,
        role,
        isAdmin,
        getToken,
        fetchWithAuth,
    };
};
