export type BadgeSize = "sm" | "md" | "lg";
export type BadgeShape = "pill" | "rounded" | "square";
export type BadgeAnimation = "none" | "wave" | "pulse" | "shine" | "bounce";
export type NameAnimation = "none" | "pulse" | "rainbow" | "shine";

export interface DecorationBadge {
    text: string;
    icon?: string;
    color?: string;
    background?: string;
    gradientColors?: string[];
    animated?: boolean;
    animation?: BadgeAnimation;
    glow?: string;
    size?: BadgeSize;
    shape?: BadgeShape;
    borderColor?: string;
}

export interface UserDecoration {
    badges: DecorationBadge[];
    nameColor?: string;
    nameGradient?: string[];
    nameGlow?: string;
    nameAnimation?: NameAnimation;
    prefix?: string;
    suffix?: string;
}

export type DecorationConfig = Record<string, UserDecoration>;

export const MAX_BADGES = 8;
export const MAX_TEXT = 32;
export const DEFAULT_API_URL = "https://messagedeco.salamangue80.workers.dev";

const DEAD_API_HINTS = ["kefoxx-fortnite", "green-voice-99d1"];

export function normalizeApiUrl(value?: string): string {
    let raw = (value ?? "").trim();
    if (!raw || DEAD_API_HINTS.some(hint => raw.includes(hint))) {
        return DEFAULT_API_URL;
    }
    raw = raw.replace(/\/+$/, "");
    if (raw.endsWith("/decorations")) {
        raw = raw.slice(0, -"/decorations".length).replace(/\/+$/, "");
    }
    return raw || DEFAULT_API_URL;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isColor(value: unknown): value is string {
    return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

const SIZES: BadgeSize[] = ["sm", "md", "lg"];
const SHAPES: BadgeShape[] = ["pill", "rounded", "square"];
const BADGE_ANIMS: BadgeAnimation[] = ["none", "wave", "pulse", "shine", "bounce"];
const NAME_ANIMS: NameAnimation[] = ["none", "pulse", "rainbow", "shine"];

function isEnum<T extends string>(value: unknown, list: T[]): value is T {
    return typeof value === "string" && list.includes(value as T);
}

export function isImageUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

export function isBadge(value: unknown): value is DecorationBadge {
    if (!isRecord(value) || typeof value.text !== "string") return false;

    return (
        value.text.trim().length > 0 &&
        value.text.length <= MAX_TEXT &&
        (value.icon === undefined || typeof value.icon === "string") &&
        (value.color === undefined || isColor(value.color)) &&
        (value.background === undefined || isColor(value.background)) &&
        (value.glow === undefined || isColor(value.glow)) &&
        (value.borderColor === undefined || isColor(value.borderColor)) &&
        (value.animated === undefined || typeof value.animated === "boolean") &&
        (value.animation === undefined || isEnum(value.animation, BADGE_ANIMS)) &&
        (value.size === undefined || isEnum(value.size, SIZES)) &&
        (value.shape === undefined || isEnum(value.shape, SHAPES)) &&
        (
            value.gradientColors === undefined ||
            (
                Array.isArray(value.gradientColors) &&
                value.gradientColors.length >= 2 &&
                value.gradientColors.length <= 8 &&
                value.gradientColors.every(isColor)
            )
        )
    );
}

export function isUserDecoration(value: unknown): value is UserDecoration {
    if (!isRecord(value) || !Array.isArray(value.badges) || value.badges.length === 0 || value.badges.length > MAX_BADGES) return false;
    if (!value.badges.every(isBadge)) return false;

    const shortText = (field: unknown) => field === undefined || (typeof field === "string" && field.length <= MAX_TEXT);

    return (
        (value.nameColor === undefined || isColor(value.nameColor)) &&
        (value.nameGlow === undefined || isColor(value.nameGlow)) &&
        (value.nameAnimation === undefined || isEnum(value.nameAnimation, NAME_ANIMS)) &&
        shortText(value.prefix) &&
        shortText(value.suffix) &&
        (
            value.nameGradient === undefined ||
            (
                Array.isArray(value.nameGradient) &&
                value.nameGradient.length >= 2 &&
                value.nameGradient.length <= 3 &&
                value.nameGradient.every(isColor)
            )
        )
    );
}

export function sanitizeDecoration(value: UserDecoration): UserDecoration {
    const cleanColor = (c: any) => isColor(c) ? c : undefined;
    const cleanText = (t: any) => typeof t === "string" && t.trim() ? t.trim().slice(0, MAX_TEXT) : undefined;

    return {
        badges: value.badges.slice(0, MAX_BADGES).map(badge => ({
            text: badge.text.trim().slice(0, MAX_TEXT) || "Badge",
            icon: badge.icon?.trim() ? badge.icon.trim().slice(0, 512) : undefined,
            color: cleanColor(badge.color),
            background: cleanColor(badge.background),
            gradientColors: Array.isArray(badge.gradientColors) && badge.gradientColors.length >= 2 && badge.gradientColors.every(isColor)
                ? badge.gradientColors
                : undefined,
            animated: badge.animated,
            animation: badge.animation ?? (badge.animated === false ? "none" : badge.gradientColors?.length ? "wave" : "wave"),
            glow: cleanColor(badge.glow),
            size: badge.size,
            shape: badge.shape,
            borderColor: cleanColor(badge.borderColor)
        })),
        nameColor: cleanColor(value.nameColor),
        nameGradient: Array.isArray(value.nameGradient) && value.nameGradient.length >= 2 && value.nameGradient.every(isColor)
            ? value.nameGradient.slice(0, 3)
            : undefined,
        nameGlow: cleanColor(value.nameGlow),
        nameAnimation: value.nameAnimation && isEnum(value.nameAnimation, NAME_ANIMS) ? value.nameAnimation : "none",
        prefix: cleanText(value.prefix),
        suffix: cleanText(value.suffix)
    };
}

export function defaultDecoration(): UserDecoration {
    return {
        badges: [{
            text: "VIP",
            icon: "👑",
            color: "#ffffff",
            background: "#5865f2",
            gradientColors: ["#ff007f", "#7928ca", "#00dfd8"],
            animation: "wave",
            animated: true,
            size: "md",
            shape: "rounded"
        }],
        nameAnimation: "none"
    };
}

export function badgeAnimationOf(badge: DecorationBadge): BadgeAnimation {
    if (badge.animation) return badge.animation;
    if (badge.animated === false) return "none";
    if (badge.gradientColors && badge.gradientColors.length >= 2) return "wave";
    return "none";
}
