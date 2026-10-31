/*
 * Vencord - MessageDecorations (Main Process Native Helper)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ConnectSrc, CspPolicies } from "@main/csp";
import type { IpcMainInvokeEvent } from "electron";

// Whitelist workers.dev domain in Discord's Content Security Policy
try {
    CspPolicies["*.workers.dev"] = ConnectSrc;
    CspPolicies["messagedeco.salamangue80.workers.dev"] = ConnectSrc;
} catch (e) {
    console.warn("[MessageDecorations Native] Failed to update CSP policies:", e);
}

export interface NativeFetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}

export interface NativeFetchResponse {
    ok: boolean;
    status: number;
    text: string;
    error?: string;
}

export async function nativeFetch(
    _: IpcMainInvokeEvent,
    url: string,
    options: NativeFetchOptions = {}
): Promise<NativeFetchResponse> {
    try {
        const response = await fetch(url, {
            method: options.method ?? "GET",
            headers: options.headers,
            body: options.body
        });

        const text = await response.text();
        return {
            ok: response.ok,
            status: response.status,
            text
        };
    } catch (err: any) {
        return {
            ok: false,
            status: 0,
            text: "",
            error: err?.message || String(err)
        };
    }
}

