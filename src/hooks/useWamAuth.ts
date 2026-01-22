import { useState, useEffect } from "react";
import { WAM_URL } from "@/config/wam";

export type WamUserRole = "Pro" | "Community" | "Guest";

interface WamAuthState {
    isAuthenticated: boolean;
    phoneNumber: string | null;
    role: WamUserRole;
    sessionId: string | null;
    isLoading: boolean;
}

export const useWamAuth = () => {
    const [authState, setAuthState] = useState<WamAuthState>({
        isAuthenticated: false,
        phoneNumber: null,
        role: "Guest",
        sessionId: localStorage.getItem("pulse_session_id"),
        isLoading: true,
    });

    const checkAuth = async (sessionId: string, retries = 3) => {
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await fetch(`${WAM_URL}/api/pulse/auth/check`, {
                    headers: {
                        "x-pulse-session": sessionId,
                    },
                });

                // Try to parse JSON, but handle non-JSON responses gracefully
                let data: any;
                try {
                    data = await response.json();
                } catch (parseError) {
                    // Server might be restarting and returning HTML or other non-JSON
                    // Treat as temporary error and retry
                    if (attempt < retries - 1) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, Math.pow(2, attempt) * 1000)
                        );
                        continue;
                    }
                    // Last attempt failed - don't clear session, might be temporary
                    console.error("WAM Auth check failed: Server returned invalid response", {
                        attempt,
                        parseError,
                    });
                    setAuthState((prev) => ({ ...prev, isLoading: false }));
                    return;
                }

                if (response.ok) {
                    setAuthState({
                        isAuthenticated: true,
                        phoneNumber: data.phoneNumber,
                        role: data.role || "Community",
                        sessionId,
                        isLoading: false,
                    });
                    return;
                }

                // Only clear session if server explicitly says it's invalid
                if (response.status === 401 && data.code === "INVALID_SESSION") {
                    console.error("[WamAuth] CLEARING SESSION - Invalid session", {
                        status: response.status,
                        code: data.code,
                        attempt,
                    });
                    localStorage.removeItem("pulse_session_id");
                    setAuthState({
                        isAuthenticated: false,
                        phoneNumber: null,
                        role: "Guest",
                        sessionId: null,
                        isLoading: false,
                    });
                    return;
                }

                // For 503 (Service Unavailable) or other errors (network, server restart, etc.), retry
                if (
                    attempt < retries - 1 &&
                    (response.status === 503 || response.status >= 500)
                ) {
                    // Exponential backoff: wait 1s, 2s, 4s
                    await new Promise((resolve) =>
                        setTimeout(resolve, Math.pow(2, attempt) * 1000)
                    );
                    continue;
                }

                // For 401 with AUTH_REQUIRED (not INVALID_SESSION), might be transient - retry once
                if (
                    attempt < retries - 1 &&
                    response.status === 401 &&
                    data.code === "AUTH_REQUIRED"
                ) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, Math.pow(2, attempt) * 1000)
                    );
                    continue;
                }

                // Last attempt failed - don't clear session, might be temporary
                console.error("WAM Auth check failed: Non-retryable error", {
                    status: response.status,
                    code: data.code,
                    attempt,
                });
                setAuthState((prev) => ({ ...prev, isLoading: false }));
                return;
            } catch (error: any) {
                // Network errors, JSON parse errors, or 503 errors - retry unless it's the last attempt
                const isRetryable =
                    !error.status ||
                    error.status >= 500 ||
                    error.status === 503 ||
                    error.message?.includes("Failed to fetch");

                console.log(
                    `[WamAuth] Auth check attempt ${attempt + 1}/${retries}`,
                    {
                        error: error.message,
                        status: error.status,
                        isRetryable,
                        willRetry: attempt < retries - 1 && isRetryable,
                    }
                );

                if (attempt < retries - 1 && isRetryable) {
                    const delay = Math.pow(2, attempt) * 1000;
                    console.log(`[WamAuth] Retrying in ${delay}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }

                // If it's a network error and we've exhausted retries, don't clear session
                // This prevents session from being cleared on server restart
                if (isRetryable && error.message?.includes("Failed to fetch")) {
                    console.error(
                        "[WamAuth] Network error after all retries - NOT clearing session",
                        {
                            error: error.message,
                            attempts: retries,
                        }
                    );
                    // Don't clear session, just mark as not loading
                    setAuthState((prev) => ({ ...prev, isLoading: false }));
                    return;
                }

                // Last attempt failed - don't clear session, might be temporary
                console.error("WAM Auth check failed: Error after retries", {
                    error: error.message,
                    attempt,
                });
                setAuthState((prev) => ({ ...prev, isLoading: false }));
                return;
            }
        }
    };

    useEffect(() => {
        if (authState.sessionId) {
            checkAuth(authState.sessionId);
        } else {
            setAuthState((prev) => ({ ...prev, isLoading: false }));
        }
    }, []);

    const requestCode = async (phoneNumber: string) => {
        const response = await fetch(`${WAM_URL}/api/pulse/auth/request-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber }),
        });
        return response.json();
    };

    const verifyCode = async (phoneNumber: string, code: string) => {
        const response = await fetch(`${WAM_URL}/api/pulse/auth/verify-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber, code }),
        });

        const data = await response.json();
        if (data.success && data.sessionId) {
            localStorage.setItem("pulse_session_id", data.sessionId);
            setAuthState({
                isAuthenticated: true,
                phoneNumber,
                role: data.role || "Community",
                sessionId: data.sessionId,
                isLoading: false,
            });
        }
        return data;
    };

    const logout = () => {
        localStorage.removeItem("pulse_session_id");
        setAuthState({
            isAuthenticated: false,
            phoneNumber: null,
            role: "Guest",
            sessionId: null,
            isLoading: false,
        });
    };

    return {
        ...authState,
        requestCode,
        verifyCode,
        logout,
    };
};
