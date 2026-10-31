import { Button } from "@components/Button";
import { classNameFactory } from "@utils/css";
import { useForceUpdater } from "@utils/react";
import type { RenderModalProps } from "@vencord/discord-types";
import { Modal, React, useEffect, useMemo, useState, UserStore } from "@webpack/common";

import { settings } from "../settings";
import {
    fetchRemoteConfig,
    getSyncState,
    publishMyDecoration,
    readConfig,
    saveFullConfig,
    saveMyDecoration,
    subscribe
} from "../store";
import {
    BadgeAnimation,
    BadgeShape,
    BadgeSize,
    DecorationBadge,
    DecorationConfig,
    defaultDecoration,
    isRecord,
    isUserDecoration,
    MAX_BADGES,
    NameAnimation,
    UserDecoration
} from "../types";
import { DecorationBadgeView, DecorationCluster, getNameStyle } from "./BadgeView";

const cl = classNameFactory("md-");

const PRESET_EMOJIS = [
    "👑", "✨", "🔥", "⚡", "💎", "⭐", "🛡️", "🚀", "💀", "👾",
    "❤️", "🎯", "🌟", "⚔️", "🌙", "🏆", "🌸", "❄️", "🍀", "🔮",
    "🦊", "🦋", "🪐", "🍕", "🎮", "🎵", "☕", "🌈"
];

const COLOR_PRESETS = [
    "#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245",
    "#00d2d3", "#9b59b6", "#f39c12", "#10b981", "#23272a", "#ffffff"
];

const GRADIENT_PRESETS = [
    { label: "Sunset", colors: ["#ff7e5f", "#feb47b"] },
    { label: "Cyberpunk", colors: ["#ff007f", "#7928ca", "#00dfd8"] },
    { label: "Nitro", colors: ["#8547ff", "#b620e0", "#f92672"] },
    { label: "Emerald", colors: ["#10b981", "#059669"] },
    { label: "Firestorm", colors: ["#f12711", "#f5af19"] },
    { label: "Ocean", colors: ["#00c6ff", "#0072ff"] },
    { label: "Galaxy", colors: ["#654ea3", "#eaafc8"] },
    { label: "Royal Gold", colors: ["#f39c12", "#f1c40f", "#e67e22"] },
    { label: "Sakura", colors: ["#ff758c", "#ff7eb3"] }
];

const TEMPLATES: { label: string; icon: string; decoration: UserDecoration; }[] = [
    {
        label: "Gold VIP",
        icon: "👑",
        decoration: {
            badges: [{
                text: "VIP ELITE",
                icon: "👑",
                color: "#ffffff",
                background: "#f39c12",
                gradientColors: ["#f39c12", "#f1c40f", "#e67e22"],
                animation: "shine",
                size: "md",
                shape: "pill",
                glow: "#f1c40f"
            }],
            nameColor: "#f1c40f",
            nameGlow: "#f39c12",
            nameAnimation: "shine"
        }
    },
    {
        label: "Cyberpunk",
        icon: "⚡",
        decoration: {
            badges: [{
                text: "CYBER",
                icon: "⚡",
                color: "#ffffff",
                background: "#ff007f",
                gradientColors: ["#ff007f", "#7928ca", "#00dfd8"],
                animation: "wave",
                size: "md",
                shape: "rounded",
                glow: "#00dfd8"
            }],
            nameGradient: ["#ff007f", "#7928ca", "#00dfd8"],
            nameGlow: "#ff007f",
            nameAnimation: "pulse"
        }
    },
    {
        label: "Nitro Booster",
        icon: "🚀",
        decoration: {
            badges: [{
                text: "BOOSTER",
                icon: "🚀",
                color: "#ffffff",
                background: "#f47fff",
                gradientColors: ["#f47fff", "#b620e0", "#8547ff"],
                animation: "pulse",
                size: "md",
                shape: "pill",
                glow: "#f47fff"
            }],
            nameGradient: ["#f47fff", "#b620e0", "#8547ff"],
            nameAnimation: "pulse"
        }
    },
    {
        label: "Firestorm",
        icon: "🔥",
        decoration: {
            badges: [{
                text: "LEGEND",
                icon: "🔥",
                color: "#ffffff",
                background: "#f12711",
                gradientColors: ["#f12711", "#f5af19"],
                animation: "wave",
                size: "md",
                shape: "rounded",
                glow: "#f12711"
            }],
            nameColor: "#f5af19",
            nameGlow: "#f12711",
            nameAnimation: "shine"
        }
    },
    {
        label: "Sakura",
        icon: "🌸",
        decoration: {
            badges: [{
                text: "SAKURA",
                icon: "🌸",
                color: "#ffffff",
                background: "#ff758c",
                gradientColors: ["#ff758c", "#ff7eb3"],
                animation: "pulse",
                size: "md",
                shape: "pill",
                glow: "#ff7eb3"
            }],
            nameColor: "#ff7eb3",
            nameGlow: "#ff758c",
            nameAnimation: "none"
        }
    },
    {
        label: "Astral Neon",
        icon: "🌌",
        decoration: {
            badges: [{
                text: "ARCANE",
                icon: "💎",
                color: "#ffffff",
                background: "#00c6ff",
                gradientColors: ["#00c6ff", "#0072ff", "#7928ca"],
                animation: "shine",
                size: "md",
                shape: "rounded",
                glow: "#00c6ff"
            }],
            nameGradient: ["#00c6ff", "#0072ff", "#7928ca"],
            nameGlow: "#00c6ff",
            nameAnimation: "shine"
        }
    }
];

const SIZES: { id: BadgeSize; label: string; }[] = [
    { id: "sm", label: "Small" },
    { id: "md", label: "Medium" },
    { id: "lg", label: "Large" }
];

const SHAPES: { id: BadgeShape; label: string; }[] = [
    { id: "pill", label: "Pill" },
    { id: "rounded", label: "Rounded" },
    { id: "square", label: "Square" }
];

const BADGE_ANIMS: { id: BadgeAnimation; label: string; }[] = [
    { id: "none", label: "None" },
    { id: "wave", label: "Gradient Wave" },
    { id: "pulse", label: "Pulse" },
    { id: "shine", label: "Shine" },
    { id: "bounce", label: "Bounce" }
];

const NAME_ANIMS: { id: NameAnimation; label: string; }[] = [
    { id: "none", label: "None" },
    { id: "pulse", label: "Pulse" },
    { id: "rainbow", label: "Rainbow Wave" },
    { id: "shine", label: "Glossy Shine" }
];

type Tab = "studio" | "gallery" | "json";

function loadMine(userId: string): UserDecoration {
    try {
        const all: DecorationConfig = JSON.parse(settings.store.userDecorations || "{}");
        if (userId && isUserDecoration(all[userId])) return all[userId];
    } catch { /* ignore */ }
    return defaultDecoration();
}

function ColorField({ value, onChange }: { value: string; onChange(next: string): void; }) {
    const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ? value.slice(0, 7) : "#5865f2";
    return (
        <div className={cl("color-wrap")}>
            <input type="color" className={cl("color")} value={hex} onChange={e => onChange(e.currentTarget.value)} />
            <input
                className={cl("input", "hex")}
                value={value}
                placeholder="#5865f2"
                onChange={e => onChange(e.currentTarget.value)}
            />
        </div>
    );
}

function Segment<T extends string>({ value, options, onChange }: {
    value: T;
    options: { id: T; label: string; }[];
    onChange(next: T): void;
}) {
    return (
        <div className={cl("segments")}>
            {options.map(option => (
                <button
                    key={option.id}
                    type="button"
                    className={cl("segment", { "segment-on": option.id === value })}
                    onClick={() => onChange(option.id)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function BadgeIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 15.3 6.8 18l1-5.8-4.2-4.1 5.8-.8L12 2z" fill="currentColor" />
        </svg>
    );
}

function ChatPreview({ decoration }: { decoration: UserDecoration; }) {
    const me = UserStore.getCurrentUser();
    const name = me?.globalName || me?.username || "You";
    const avatar = me?.getAvatarURL?.(null, 80, true) ?? null;

    return (
        <div className={cl("preview")}>
            {avatar
                ? <img className={cl("avatar")} src={avatar} alt="" />
                : <div className={cl("avatar", "avatar-fallback")}>{name.slice(0, 1).toUpperCase()}</div>}
            <div className={cl("preview-body")}>
                <div className={cl("preview-head")}>
                    <span
                        className={[
                            cl("author"),
                            decoration.nameAnimation && decoration.nameAnimation !== "none"
                                ? `vc-message-decorations-name-${decoration.nameAnimation}`
                                : ""
                        ].filter(Boolean).join(" ")}
                        style={getNameStyle(decoration)}
                    >
                        {name}
                    </span>
                    <DecorationCluster decoration={decoration} userId={me?.id ?? "me"} />
                    <span className={cl("time")}>Today at 6:42 PM</span>
                </div>
                <div className={cl("preview-text")}>
                    Hey! Check out my custom animated badges and glowing username style.
                </div>
            </div>
        </div>
    );
}

export function DecorationEditorModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const me = UserStore.getCurrentUser();
    const userId = me?.id ?? "";
    const redraw = useForceUpdater();

    const [tab, setTab] = useState<Tab>("studio");
    const [decoration, setDecoration] = useState<UserDecoration>(() => loadMine(userId));
    const [selected, setSelected] = useState(0);
    const [rawJson, setRawJson] = useState("");
    const [jsonError, setJsonError] = useState("");
    const [status, setStatus] = useState<{ type: "ok" | "err"; text: string; } | null>(null);
    const [busy, setBusy] = useState(false);
    const [searchGallery, setSearchGallery] = useState("");

    useEffect(() => subscribe(redraw), [redraw]);

    const badges = decoration.badges;
    const current = badges[selected] ?? badges[0];
    const sync = getSyncState();

    const update = (next: Partial<UserDecoration>) => setDecoration({ ...decoration, ...next });

    const updateBadge = (patch: Partial<DecorationBadge>) => {
        const next = badges.map((badge, index) => index === selected ? { ...badge, ...patch } : badge);
        update({ badges: next });
    };

    const addBadge = () => {
        if (badges.length >= MAX_BADGES) return;
        const next: DecorationBadge = {
            text: `Badge ${badges.length + 1}`,
            icon: "✨",
            color: "#ffffff",
            background: "#5865f2",
            animation: "wave",
            size: "md",
            shape: "rounded"
        };
        update({ badges: [...badges, next] });
        setSelected(badges.length);
    };

    const duplicateBadge = (index: number) => {
        if (badges.length >= MAX_BADGES) return;
        const toDup = badges[index];
        if (!toDup) return;
        const cloned: DecorationBadge = { ...toDup, text: `${toDup.text} copy` };
        const next = [...badges.slice(0, index + 1), cloned, ...badges.slice(index + 1)];
        update({ badges: next });
        setSelected(index + 1);
    };

    const removeBadge = (index: number) => {
        if (badges.length <= 1) {
            setStatus({ type: "err", text: "You must keep at least one badge." });
            return;
        }
        update({ badges: badges.filter((_, i) => i !== index) });
        setSelected(Math.max(0, index - 1));
    };

    const applyTemplate = (tmpl: UserDecoration) => {
        setDecoration({ ...tmpl });
        setSelected(0);
        setStatus({ type: "ok", text: "Preset applied successfully!" });
    };

    const persistLocal = () => {
        saveMyDecoration(decoration);
        if (settings.store.autoPublish) {
            void publish();
            return;
        }
        setStatus({ type: "ok", text: "Saved locally." });
    };

    const publish = async () => {
        setBusy(true);
        setStatus(null);
        try {
            saveMyDecoration(decoration);
            await publishMyDecoration(decoration);
            setStatus({ type: "ok", text: "Published to everyone! All users now see your style." });
        } catch (error: any) {
            setStatus({ type: "err", text: error?.message || "Failed to publish" });
        } finally {
            setBusy(false);
        }
    };

    const openJson = () => {
        const all = readConfig();
        if (userId) all[userId] = decoration;
        setRawJson(JSON.stringify(all, null, 4));
        setJsonError("");
        setTab("json");
    };

    const applyJson = () => {
        try {
            const parsed = JSON.parse(rawJson);
            if (!isRecord(parsed)) throw new Error("Must be a JSON object");
            const next: DecorationConfig = {};
            for (const [id, value] of Object.entries(parsed)) {
                if (!/^\d{17,20}$/.test(id) || !isUserDecoration(value)) {
                    throw new Error(`Invalid entry for user ID: ${id}`);
                }
                next[id] = value;
            }
            saveFullConfig(next);
            if (userId && next[userId]) setDecoration(next[userId]);
            setJsonError("");
            setTab("studio");
            setStatus({ type: "ok", text: "JSON configuration applied successfully." });
        } catch (error: any) {
            setJsonError(error?.message || "Invalid JSON syntax");
        }
    };

    const allConfigs = readConfig();
    const gallery = useMemo(() => {
        const entries = Object.entries(allConfigs);
        if (!searchGallery.trim()) return entries;
        const q = searchGallery.toLowerCase();
        return entries.filter(([id, deco]) => {
            if (id.includes(q)) return true;
            const u = UserStore.getUser(id);
            if (u?.username?.toLowerCase().includes(q)) return true;
            if (u?.globalName?.toLowerCase().includes(q)) return true;
            if (deco.badges.some(b => b.text.toLowerCase().includes(q))) return true;
            return false;
        });
    }, [allConfigs, searchGallery]);

    return (
        <Modal
            {...modalProps}
            size="lg"
            title="Badge Creator"
            subtitle="Design, animate & share custom badges and username styles across Discord"
            actions={[
                { text: "Close", variant: "secondary", onClick: modalProps.onClose },
                { text: "Save Locally", variant: "secondary", onClick: persistLocal },
                {
                    text: busy ? "Publishing…" : "Publish to Everyone",
                    variant: "primary",
                    onClick: () => void publish(),
                    loading: busy,
                    disabled: busy
                }
            ]}
        >
            <div className={cl("root")}>
                <div className={cl("head")}>
                    <div className={cl("head-icon")}><BadgeIcon /></div>
                    <div className={cl("head-text")}>
                        <div className={cl("head-title")}>Badge Creator</div>
                        <div className={cl("head-line")}>
                            {sync.count} user profile{sync.count === 1 ? "" : "s"} live on the network
                            {sync.error ? ` • ${sync.error}` : ""}
                        </div>
                    </div>
                    <button
                        type="button"
                        className={cl("status", `status-${sync.state}`)}
                        onClick={() => void fetchRemoteConfig(true)}
                        title="Click to sync now"
                    >
                        <span className={cl("status-dot")} />
                        {sync.state === "good" ? "Online" : sync.state === "waiting" ? "Syncing…" : "Offline"}
                    </button>
                </div>

                <div className={cl("controls")}>
                    <div className={cl("segments")}>
                        {([
                            ["studio", "Studio"],
                            ["gallery", `Gallery (${gallery.length})`],
                            ["json", "JSON (Advanced)"]
                        ] as const).map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                className={cl("segment", { "segment-on": tab === id })}
                                onClick={() => id === "json" ? openJson() : setTab(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {status && (
                    <div className={cl("alert", status.type === "ok" ? "alert-ok" : "alert-err")}>
                        {status.text}
                    </div>
                )}

                {tab === "studio" && (
                    <>
                        <section className={cl("card", "card-preview")}>
                            <div className={cl("section-head")}>
                                <div className={cl("section-title")}>Live Chat Preview</div>
                            </div>
                            <ChatPreview decoration={decoration} />
                        </section>

                        <section className={cl("card")}>
                            <div className={cl("section-title")}>Quick Presets</div>
                            <div className={cl("templates-row")}>
                                {TEMPLATES.map(t => (
                                    <button
                                        key={t.label}
                                        type="button"
                                        className={cl("template-btn")}
                                        onClick={() => applyTemplate(t.decoration)}
                                    >
                                        <span>{t.icon}</span>
                                        <span>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className={cl("card")}>
                            <div className={cl("section-head")}>
                                <div className={cl("section-title")}>Your Badges ({badges.length}/{MAX_BADGES})</div>
                                <div style={{ display: "flex", gap: 6 }}>
                                    {badges.length < MAX_BADGES && current && (
                                        <Button size="small" variant="secondary" onClick={() => duplicateBadge(selected)}>Duplicate</Button>
                                    )}
                                    {badges.length < MAX_BADGES && (
                                        <Button size="small" variant="primary" onClick={addBadge}>+ Add Badge</Button>
                                    )}
                                </div>
                            </div>
                            <div className={cl("pills")}>
                                {badges.map((badge, index) => (
                                    <div
                                        key={index}
                                        className={cl("pill", { "pill-on": index === selected })}
                                        onClick={() => setSelected(index)}
                                    >
                                        <DecorationBadgeView badge={badge} />
                                        {badges.length > 1 && (
                                            <button
                                                type="button"
                                                className={cl("pill-x")}
                                                title="Delete this badge"
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    removeBadge(index);
                                                }}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {current && (
                            <section className={cl("card")}>
                                <div className={cl("section-head")}>
                                    <div className={cl("section-title")}>Badge Editor: {current.text}</div>
                                </div>
                                <div className={cl("row")}>
                                    <label className={cl("field")}>
                                        <span>Badge Label</span>
                                        <input
                                            className={cl("input")}
                                            maxLength={32}
                                            value={current.text}
                                            placeholder="Badge label"
                                            onChange={e => updateBadge({ text: e.currentTarget.value || "Badge" })}
                                        />
                                    </label>
                                    <label className={cl("field")}>
                                        <span>Icon (Emoji or https:// URL)</span>
                                        <input
                                            className={cl("input")}
                                            value={current.icon ?? ""}
                                            placeholder="e.g. 👑 or https://..."
                                            onChange={e => updateBadge({ icon: e.currentTarget.value })}
                                        />
                                    </label>
                                </div>

                                <div className={cl("field")}>
                                    <span>Quick Emojis</span>
                                    <div className={cl("emoji-bar")}>
                                        {PRESET_EMOJIS.map(emoji => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                className={cl("emoji")}
                                                onClick={() => updateBadge({ icon: emoji })}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={cl("row")}>
                                    <div className={cl("field")}>
                                        <span>Size</span>
                                        <Segment value={current.size ?? "md"} options={SIZES} onChange={size => updateBadge({ size })} />
                                    </div>
                                    <div className={cl("field")}>
                                        <span>Shape</span>
                                        <Segment value={current.shape ?? "rounded"} options={SHAPES} onChange={shape => updateBadge({ shape })} />
                                    </div>
                                </div>

                                <div className={cl("field")}>
                                    <span>Animation Effect</span>
                                    <Segment
                                        value={current.animation ?? (current.animated === false ? "none" : "wave")}
                                        options={BADGE_ANIMS}
                                        onChange={animation => updateBadge({ animation, animated: animation !== "none" })}
                                    />
                                </div>

                                <div className={cl("field")}>
                                    <span>Background Style</span>
                                    <div className={cl("segments")}>
                                        <button
                                            type="button"
                                            className={cl("segment", { "segment-on": !current.gradientColors?.length })}
                                            onClick={() => updateBadge({ gradientColors: undefined })}
                                        >
                                            Solid Color
                                        </button>
                                        <button
                                            type="button"
                                            className={cl("segment", { "segment-on": Boolean(current.gradientColors?.length) })}
                                            onClick={() => updateBadge({
                                                gradientColors: current.gradientColors?.length
                                                    ? current.gradientColors
                                                    : ["#ff007f", "#7928ca", "#00dfd8"],
                                                animation: current.animation && current.animation !== "none" ? current.animation : "wave"
                                            })}
                                        >
                                            Animated Gradient
                                        </button>
                                    </div>
                                </div>

                                {!current.gradientColors?.length ? (
                                    <div className={cl("field")}>
                                        <span>Background Color</span>
                                        <ColorField value={current.background ?? "#5865f2"} onChange={background => updateBadge({ background })} />
                                        <div className={cl("swatches")}>
                                            {COLOR_PRESETS.map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    className={cl("swatch")}
                                                    style={{ background: color }}
                                                    onClick={() => updateBadge({ background: color })}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={cl("field")}>
                                        <span>Gradient Palettes</span>
                                        <div className={cl("gradients")}>
                                            {GRADIENT_PRESETS.map(preset => (
                                                <button
                                                    key={preset.label}
                                                    type="button"
                                                    className={cl("gradient")}
                                                    style={{ backgroundImage: `linear-gradient(110deg, ${preset.colors.join(", ")})` }}
                                                    onClick={() => updateBadge({ gradientColors: [...preset.colors] })}
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className={cl("row")}>
                                    <label className={cl("field")}>
                                        <span>Text Color</span>
                                        <ColorField value={current.color ?? "#ffffff"} onChange={color => updateBadge({ color })} />
                                    </label>
                                    <label className={cl("field")}>
                                        <span>Border Color</span>
                                        <ColorField
                                            value={current.borderColor ?? current.background ?? "#5865f2"}
                                            onChange={borderColor => updateBadge({ borderColor })}
                                        />
                                    </label>
                                    <label className={cl("field")}>
                                        <span>Aura Glow</span>
                                        <label className={cl("check")}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(current.glow)}
                                                onChange={e => updateBadge({ glow: e.currentTarget.checked ? (current.color ?? "#5865f2") : undefined })}
                                            />
                                            Enable Glow
                                        </label>
                                        {current.glow && (
                                            <ColorField value={current.glow} onChange={glow => updateBadge({ glow })} />
                                        )}
                                    </label>
                                </div>
                            </section>
                        )}

                        <section className={cl("card")}>
                            <div className={cl("section-title")}>Username & Profile Styling</div>
                            <div className={cl("row")}>
                                <label className={cl("check")}>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(decoration.nameColor || decoration.nameGradient)}
                                        onChange={e => update({
                                            nameColor: e.currentTarget.checked ? (decoration.nameColor ?? "#5865f2") : undefined,
                                            nameGradient: e.currentTarget.checked ? decoration.nameGradient : undefined
                                        })}
                                    />
                                    Custom Name Color
                                </label>
                                {(decoration.nameColor || decoration.nameGradient) && (
                                    <ColorField
                                        value={decoration.nameColor ?? "#5865f2"}
                                        onChange={nameColor => update({ nameColor })}
                                    />
                                )}
                            </div>

                            <div className={cl("field")}>
                                <span>Nitro Name Gradient</span>
                                <div className={cl("gradients")}>
                                    {GRADIENT_PRESETS.map(preset => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            className={cl("gradient")}
                                            style={{ backgroundImage: `linear-gradient(90deg, ${preset.colors.join(", ")})` }}
                                            onClick={() => update({
                                                nameGradient: preset.colors.slice(0, 3),
                                                nameColor: preset.colors[0]
                                            })}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        className={cl("gradient", "gradient-off")}
                                        onClick={() => update({ nameGradient: undefined })}
                                    >
                                        Disable Gradient
                                    </button>
                                </div>
                            </div>

                            <div className={cl("field")}>
                                <span>Name Animation</span>
                                <Segment
                                    value={decoration.nameAnimation ?? "none"}
                                    options={NAME_ANIMS}
                                    onChange={nameAnimation => update({ nameAnimation })}
                                />
                            </div>

                            <div className={cl("row")}>
                                <label className={cl("field")}>
                                    <span>Name Glow</span>
                                    <label className={cl("check")}>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(decoration.nameGlow)}
                                            onChange={e => update({ nameGlow: e.currentTarget.checked ? (decoration.nameColor ?? "#5865f2") : undefined })}
                                        />
                                        Enable Glow
                                    </label>
                                    {decoration.nameGlow && (
                                        <ColorField value={decoration.nameGlow} onChange={nameGlow => update({ nameGlow })} />
                                    )}
                                </label>
                                <label className={cl("field")}>
                                    <span>Prefix Tag</span>
                                    <input
                                        className={cl("input")}
                                        maxLength={32}
                                        value={decoration.prefix ?? ""}
                                        placeholder="e.g. [DEV]"
                                        onChange={e => update({ prefix: e.currentTarget.value || undefined })}
                                    />
                                </label>
                                <label className={cl("field")}>
                                    <span>Suffix Tag</span>
                                    <input
                                        className={cl("input")}
                                        maxLength={32}
                                        value={decoration.suffix ?? ""}
                                        placeholder="e.g. ★"
                                        onChange={e => update({ suffix: e.currentTarget.value || undefined })}
                                    />
                                </label>
                            </div>
                        </section>
                    </>
                )}

                {tab === "gallery" && (
                    <section className={cl("card")}>
                        <div className={cl("section-head")}>
                            <div className={cl("section-title")}>Community Profiles ({gallery.length})</div>
                            <Button size="small" variant="secondary" onClick={() => void fetchRemoteConfig(true)}>Refresh</Button>
                        </div>
                        <input
                            className={cl("input")}
                            placeholder="Search by username, Discord ID or badge text…"
                            value={searchGallery}
                            onChange={e => setSearchGallery(e.currentTarget.value)}
                        />
                        {gallery.length === 0 ? (
                            <div className={cl("empty")}>
                                No profiles found. Publish your badges in the Studio to appear here!
                            </div>
                        ) : (
                            <div className={cl("gallery-grid")}>
                                {gallery.map(([id, deco]) => {
                                    const user = UserStore.getUser(id);
                                    const name = user?.globalName || user?.username || id;
                                    const isMe = id === userId;
                                    return (
                                        <div key={id} className={cl("row-user")}>
                                            <div className={cl("row-meta")}>
                                                <div className={cl("row-name")}>
                                                    {name} {isMe && <span className={cl("badge-me")}>You</span>}
                                                </div>
                                                <div className={cl("row-id")}>{id}</div>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 150 }}>
                                                <DecorationCluster decoration={deco} userId={id} />
                                            </div>
                                            {!isMe && (
                                                <Button
                                                    size="small"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setDecoration(JSON.parse(JSON.stringify(deco)));
                                                        setSelected(0);
                                                        setTab("studio");
                                                        setStatus({ type: "ok", text: `Loaded style from ${name} into your studio!` });
                                                    }}
                                                >
                                                    Copy Style
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {tab === "json" && (
                    <section className={cl("card")}>
                        <div className={cl("section-head")}>
                            <div className={cl("section-title")}>Raw JSON Configuration (Import / Export)</div>
                            <Button size="small" variant="primary" onClick={applyJson}>Apply JSON</Button>
                        </div>
                        <textarea
                            className={cl("textarea")}
                            spellCheck={false}
                            value={rawJson}
                            onChange={e => {
                                setRawJson(e.currentTarget.value);
                                setJsonError("");
                            }}
                        />
                        {jsonError && <div className={cl("alert", "alert-err")}>{jsonError}</div>}
                    </section>
                )}
            </div>
        </Modal>
    );
}
