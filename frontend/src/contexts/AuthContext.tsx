import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, clearToken, getToken, setToken } from "@/src/api/client";

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
};

type AuthState = {
  loading: boolean;
  user: User | null;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);
const DEMO_USER: User = {
  user_id: "demo-user",
  email: "demo@grounded.daily",
  name: "Demo User",
  picture: null,
};
const BYPASS_AUTH = process.env.EXPO_PUBLIC_BYPASS_AUTH !== "false";

function getRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin + "/";
  }
  return Linking.createURL("auth");
}

function parseSessionId(url: string): string | null {
  try {
    // Hash fragment first
    const hashIdx = url.indexOf("#");
    if (hashIdx >= 0) {
      const frag = url.slice(hashIdx + 1);
      const params = new URLSearchParams(frag);
      const sid = params.get("session_id");
      if (sid) return sid;
    }
    const qIdx = url.indexOf("?");
    if (qIdx >= 0) {
      const params = new URLSearchParams(url.slice(qIdx + 1));
      const sid = params.get("session_id");
      if (sid) return sid;
    }
  } catch {
    /* noop */
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {
      await clearToken();
      setUser(null);
    }
  }, []);

  const processSessionId = useCallback(async (sid: string) => {
    setAuthError(null);
    try {
      const res = await api<{ session_token: string; user: User }>(
        "/auth/session",
        { method: "POST", body: { session_id: sid }, auth: false }
      );
      await setToken(res.session_token);
      setUser(res.user);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to complete Google sign-in.";
      console.warn("session exchange failed", e);
      setAuthError(message);
    }
  }, []);

  // Web: detect session_id on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      if (BYPASS_AUTH) {
        setUser(DEMO_USER);
        setLoading(false);
        return;
      }
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const sid = parseSessionId(window.location.href);
        if (sid) {
          await processSessionId(sid);
          // Clean URL
          try {
            window.history.replaceState(null, "", window.location.pathname);
          } catch {
            /* noop */
          }
          setLoading(false);
          return;
        }
      } else {
        // Mobile cold start
        const initial = await Linking.getInitialURL();
        if (initial) {
          const sid = parseSessionId(initial);
          if (sid) {
            await processSessionId(sid);
            setLoading(false);
            return;
          }
        }
      }
      const token = await getToken();
      if (token) {
        await fetchMe();
      }
      setLoading(false);
    })();
  }, [fetchMe, processSessionId]);

  // Mobile hot deep links
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", async (ev) => {
      const sid = parseSessionId(ev.url);
      if (sid) await processSessionId(sid);
    });
    return () => sub.remove();
  }, [processSessionId]);

  const signIn = useCallback(async () => {
    if (BYPASS_AUTH) {
      setUser(DEMO_USER);
      return;
    }
    setAuthError(null);
    const redirectUrl = getRedirectUrl();
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = authUrl;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const sid = parseSessionId(result.url);
      if (sid) await processSessionId(sid);
    }
  }, [processSessionId]);

  const signOut = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* noop */
    }
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, user, authError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
