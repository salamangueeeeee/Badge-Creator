import { UserStore } from "@webpack/common";

import { settings } from "./settings";
import {
    DecorationConfig,
    DEFAULT_API_URL,
    isRecord,
    isUserDecoration,
    normalizeApiUrl,
    sanitizeDecoration,
    UserDecoration
} from "./types";

export type SyncState = "good" | "waiting" | "bad";

let remoteConfig: DecorationConfig = {};
let lastFetch = 0;
let lastError = "";
let syncState: SyncState = "waiting";
let pollTimer: ReturnType<typeof setInterval> | null = null;
let bgFetchTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

export function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function emit() {
    for (const listener of listeners) {
        try { listener(); } catch { /* ignore */ }
    }
}

export function getSyncState() {
    return {
        state: syncState,
        error: lastError,
        count: Object.keys(remoteConfig).length,
        lastFetch
    };
}

export function getApiUrl(): string {
    const raw = settings.store.apiUrl ?? "";
    const clean = normalizeApiUrl(raw);
    const canonical = clean.endsWith("/") ? clean : `${clean}/`;
    if (raw !== canonical) {
        settings.store.apiUrl = canonical;
    }
    return clean;
}

export function generateSecret(): string {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}

export function ensureSecret(): string {
    if (!settings.store.mySecret || settings.store.mySecret.length < 16) {
        settings.store.mySecret = generateSecret();
    }
    return settings.store.mySecret;
}

function parseLocal(): DecorationConfig {
    try {
        const local = JSON.parse(settings.store.userDecorations || "{}");
        if (!isRecord(local)) return {};
        const result: DecorationConfig = {};
        for (const [userId, decoration] of Object.entries(local)) {
            if (/^\d{17,20}$/.test(userId) && isUserDecoration(decoration)) {
                result[userId] = sanitizeDecoration(decoration);
            }
        }
        return result;
    } catch {
        return {};
    }
}

export function readConfig(): DecorationConfig {
    const config: DecorationConfig = { ...remoteConfig };
    const local = parseLocal();
    const me = UserStore.getCurrentUser()?.id;

    if (me && local[me]) {
        config[me] = local[me];
    }

    for (const [userId, decoration] of Object.entries(local)) {
        if (!config[userId]) {
            config[userId] = decoration;
        }
    }
    return config;
}

export function getDecoration(userId?: string | null): UserDecoration | undefined {
    if (!userId) return undefined;
    return readConfig()[userId];
}

export function saveMyDecoration(decoration: UserDecoration) {
    const me = UserStore.getCurrentUser()?.id;
    if (!me) throw new Error("Could not find your Discord account (make sure you are logged in)");

    const all = parseLocal();
    all[me] = sanitizeDecoration(decoration);
    settings.store.userDecorations = JSON.stringify(all, null, 4);
    emit();
}

export function saveFullConfig(config: DecorationConfig) {
    settings.store.userDecorations = JSON.stringify(config, null, 4);
    emit();
}

interface RequestOptions {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
}

interface RequestResult {
    ok: boolean;
    status: number;
    text: string;
    data?: any;
    error?: string;
}

async function requestApi(url: string, options: RequestOptions = {}): Promise<RequestResult> {
    const headers = {
        Accept: "application/json",
        ...options.headers
    };

    // 1. Try standard renderer fetch with 10s timeout
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const res = await fetch(url, {
            method: options.method ?? "GET",
            headers,
            body: options.body,
            signal: controller.signal
        });
        clearTimeout(timeout);

        const text = await res.text();
        let data: any = null;
        try {
            data = JSON.parse(text);
        } catch {
            data = null;
        }

        return {
            ok: res.ok,
            status: res.status,
            text,
            data,
            error: res.ok ? undefined : (data?.error || `HTTP ${res.status}`)
        };
    } catch (err: any) {
        console.warn("[BadgeCreator] Renderer fetch failed, falling back to native:", err?.message || err);

        // 2. Electron main-process native fetch fallback
        try {
            const Native = (typeof VencordNative !== "undefined" && VencordNative?.pluginHelpers?.MessageDecorations) as any;
            if (Native?.nativeFetch) {
                const nativeRes = await Native.nativeFetch(url, {
                    method: options.method ?? "GET",
                    headers,
                    body: options.body
                });

                let data: any = null;
                try {
                    data = JSON.parse(nativeRes.text);
                } catch {
                    data = null;
                }

                return {
                    ok: nativeRes.ok,
                    status: nativeRes.status,
                    text: nativeRes.text,
                    data,
                    error: nativeRes.ok ? undefined : (data?.error || nativeRes.error || `HTTP ${nativeRes.status}`)
                };
            }
        } catch (nativeErr) {
            console.error("[BadgeCreator] Native fallback failed:", nativeErr);
        }

        const msg = err?.name === "AbortError" ? "Request timed out (10s)" : (err?.message || "Network error");
        return {
            ok: false,
            status: 0,
            text: "",
            error: msg
        };
    }
}

export async function fetchRemoteConfig(force = false): Promise<boolean> {
    const minDelay = force ? 2_000 : 6_000;
    if (Date.now() - lastFetch < minDelay) {
        return syncState === "good";
    }

    lastFetch = Date.now();
    syncState = "waiting";
    emit();

    let baseUrl: string;
    try {
        baseUrl = getApiUrl();
    } catch {
        baseUrl = DEFAULT_API_URL;
    }

    const endpoint = `${baseUrl}/decorations?t=${Date.now()}`;
    const res = await requestApi(endpoint);

    if (!res.ok) {
        lastError = res.error || `HTTP ${res.status}`;
        syncState = "bad";
        emit();
        return false;
    }

    const parsed = res.data;
    if (!isRecord(parsed)) {
        lastError = "Invalid server response (JSON expected)";
        syncState = "bad";
        emit();
        return false;
    }

    const result: DecorationConfig = {};
    for (const [userId, decoration] of Object.entries(parsed)) {
        if (/^\d{17,20}$/.test(userId) && isUserDecoration(decoration)) {
            result[userId] = sanitizeDecoration(decoration);
        }
    }

    remoteConfig = result;
    lastError = "";
    syncState = "good";
    emit();
    return true;
}

export function triggerBackgroundFetch() {
    if (bgFetchTimer) return;
    bgFetchTimer = setTimeout(() => {
        bgFetchTimer = null;
        void fetchRemoteConfig(true);
    }, 1500);
}

export interface PublishResult {
    ok: boolean;
    persistent: boolean;
    warning?: string;
}

export async function publishMyDecoration(decorationToPublish?: UserDecoration): Promise<PublishResult> {
    const secret = ensureSecret();

    const me = UserStore.getCurrentUser();
    if (!me?.id) {
        throw new Error("Could not find your Discord user. Make sure you are logged in.");
    }

    const myDecoration = decorationToPublish ?? parseLocal()[me.id];
    if (!myDecoration) {
        throw new Error("No decoration configured to publish. Create a badge first.");
    }
    if (!myDecoration.badges?.length) {
        throw new Error("Add at least one badge before publishing.");
    }

    let baseUrl: string;
    try {
        baseUrl = getApiUrl();
    } catch {
        baseUrl = DEFAULT_API_URL;
    }

    const endpoint = `${baseUrl}/decorations`;
    const cleanDeco = sanitizeDecoration(myDecoration);

    const res = await requestApi(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId: me.id,
            decoration: cleanDeco,
            secret
        })
    });

    if (!res.ok) {
        throw new Error(res.error || `Publish failed (${res.status})`);
    }

    const persistent = res.data?.persistent ?? true;
    const warning = res.data?.notice;

    // Immediately fetch back so local state is synchronized
    await fetchRemoteConfig(true);

    return {
        ok: true,
        persistent,
        warning
    };
}

function onWindowFocus() {
    // When Discord is focused, check for new badges immediately
    void fetchRemoteConfig(true);
}

export function startPolling() {
    stopPolling();
    // Fast initial fetch
    setTimeout(() => void fetchRemoteConfig(true), 500);
    // Poll every 8 seconds for near real-time sync with friends
    pollTimer = setInterval(() => void fetchRemoteConfig(true), 8_000);

    if (typeof window !== "undefined") {
        window.addEventListener("focus", onWindowFocus);
    }
}

export function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (bgFetchTimer) {
        clearTimeout(bgFetchTimer);
        bgFetchTimer = null;
    }
    if (typeof window !== "undefined") {
        window.removeEventListener("focus", onWindowFocus);
    }
}
