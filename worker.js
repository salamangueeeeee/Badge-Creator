const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
};

const ID = /^\d{17,20}$/;

// Fallback in-memory storage when Cloudflare KV "DECOS" is not bound
let memoryAll = "{}";
let memorySecrets = "{}";

function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...CORS,
            "Content-Type": "application/json",
            ...extraHeaders
        },
    });
}

function isColor(value) {
    return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

function isBadge(b) {
    if (!b || typeof b !== "object") return false;
    if (typeof b.text !== "string" || b.text.trim().length === 0 || b.text.length > 32) return false;
    if (b.color && !isColor(b.color)) return false;
    if (b.background && !isColor(b.background)) return false;
    if (b.glow && !isColor(b.glow)) return false;
    if (b.borderColor && !isColor(b.borderColor)) return false;
    return true;
}

function isDecoration(d) {
    if (!d || typeof d !== "object") return false;
    if (!Array.isArray(d.badges) || d.badges.length === 0 || d.badges.length > 8) return false;
    if (!d.badges.every(isBadge)) return false;
    if (d.nameColor && !isColor(d.nameColor)) return false;
    if (d.nameGlow && !isColor(d.nameGlow)) return false;
    return true;
}

export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS });
        }

        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, "") || "/";
        if (path !== "/" && path !== "/decorations") {
            return json({ error: "Endpoint not found" }, 404);
        }

        const store = env?.DECOS;

        if (request.method === "GET") {
            try {
                const data = store ? (await store.get("all")) : memoryAll;
                return new Response(data || "{}", {
                    headers: {
                        ...CORS,
                        "Content-Type": "application/json",
                        "Cache-Control": "no-store, no-cache, must-revalidate",
                        ...(store ? {} : { "X-Storage-Mode": "memory-fallback" })
                    },
                });
            } catch (err) {
                return json({ error: "Erreur lecture données: " + (err?.message || err) }, 500);
            }
        }

        if (request.method === "POST") {
            let body;
            try {
                body = await request.json();
            } catch {
                return json({ error: "Corps JSON invalide" }, 400);
            }

            const { userId, decoration, secret } = body || {};

            if (!ID.test(userId || "")) {
                return json({ error: "userId invalide (doit être un ID Discord de 17-20 chiffres)" }, 400);
            }

            if (typeof secret !== "string" || secret.length < 16) {
                return json({ error: "secret invalide (au moins 16 caractères)" }, 400);
            }

            if (!isDecoration(decoration)) {
                return json({ error: "Décoration invalide (au moins 1 badge requis, max 8)" }, 400);
            }

            try {
                let secrets = {};
                let all = {};

                if (store) {
                    secrets = JSON.parse((await store.get("secrets")) || "{}");
                    all = JSON.parse((await store.get("all")) || "{}");
                } else {
                    secrets = JSON.parse(memorySecrets || "{}");
                    all = JSON.parse(memoryAll || "{}");
                }

                // Check secret ownership for this userId
                if (secrets[userId] && secrets[userId] !== secret) {
                    return json({ error: "Secret incorrect pour cet utilisateur. Impossible de modifier." }, 403);
                }

                secrets[userId] = secret;
                all[userId] = decoration;

                const secretsStr = JSON.stringify(secrets);
                const allStr = JSON.stringify(all);

                if (store) {
                    await store.put("secrets", secretsStr);
                    await store.put("all", allStr);
                } else {
                    memorySecrets = secretsStr;
                    memoryAll = allStr;
                }

                return json({
                    ok: true,
                    persistent: Boolean(store),
                    notice: store ? undefined : "KV 'DECOS' non lié dans Cloudflare Dashboard (stocké temporairement en mémoire)"
                });
            } catch (err) {
                return json({ error: "Erreur écriture: " + (err?.message || err) }, 500);
            }
        }

        return json({ error: "Méthode non autorisée" }, 405);
    },
};
