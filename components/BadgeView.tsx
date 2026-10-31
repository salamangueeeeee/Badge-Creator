import { React } from "@webpack/common";

import { badgeAnimationOf, DecorationBadge, isImageUrl, UserDecoration } from "../types";

export function getBadgeStyle(badge: DecorationBadge): React.CSSProperties {
    const hasGradient = Boolean(badge.gradientColors && badge.gradientColors.length >= 2);
    const glow = badge.glow;

    return {
        color: badge.color ?? "#ffffff",
        backgroundColor: hasGradient ? undefined : (badge.background ?? "#5865f2"),
        backgroundImage: hasGradient
            ? `linear-gradient(110deg, ${badge.gradientColors!.join(", ")})`
            : undefined,
        borderColor: badge.borderColor ?? (hasGradient ? "transparent" : (badge.background ?? "#5865f2")),
        boxShadow: glow ? `0 0 10px ${glow}, 0 0 2px ${glow}` : undefined
    };
}

export function getNameStyle(decoration?: UserDecoration): React.CSSProperties {
    if (!decoration) return {};

    const gradient = decoration.nameGradient?.filter(Boolean) ?? [];
    const color = gradient.length >= 2
        ? undefined
        : decoration.nameColor;

    return {
        color,
        backgroundImage: gradient.length >= 2
            ? `linear-gradient(90deg, ${gradient.join(", ")})`
            : undefined,
        WebkitBackgroundClip: gradient.length >= 2 ? "text" : undefined,
        backgroundClip: gradient.length >= 2 ? "text" : undefined,
        WebkitTextFillColor: gradient.length >= 2 ? "transparent" : undefined,
        textShadow: decoration.nameGlow ? `0 0 10px ${decoration.nameGlow}` : undefined
    };
}

function badgeClass(badge: DecorationBadge) {
    const animation = badgeAnimationOf(badge);
    const size = badge.size ?? "md";
    const shape = badge.shape ?? "rounded";
    const hasGradient = Boolean(badge.gradientColors && badge.gradientColors.length >= 2);
    const isAnimated = badge.animated !== false && (animation !== "none" || hasGradient);

    return [
        "vc-message-decorations-badge",
        hasGradient ? "vc-message-decorations-gradient" : "",
        isAnimated ? "vc-message-decorations-animated" : "",
        `vc-message-decorations-size-${size}`,
        `vc-message-decorations-shape-${shape}`,
        animation !== "none"
            ? `vc-message-decorations-anim-${animation}`
            : (hasGradient && isAnimated ? "vc-message-decorations-anim-wave" : "")
    ].filter(Boolean).join(" ");
}

export function DecorationBadgeView({ badge }: { badge: DecorationBadge; }) {
    const icon = badge.icon?.trim();
    const isImage = Boolean(icon && isImageUrl(icon));

    return (
        <span
            className={badgeClass(badge)}
            title={badge.text}
            style={getBadgeStyle(badge)}
        >
            {icon && (
                isImage
                    ? <img className="vc-message-decorations-icon" src={icon} alt="" loading="lazy" draggable={false} />
                    : <span className="vc-message-decorations-emoji">{icon}</span>
            )}
            <span>{badge.text}</span>
        </span>
    );
}

export function DecorationCluster({ decoration, userId }: { decoration: UserDecoration; userId: string; }) {
    const prefix = decoration.prefix?.trim();
    const suffix = decoration.suffix?.trim();

    if (!decoration.badges?.length && !prefix && !suffix) return null;

    return (
        <span className="vc-message-decorations">
            {prefix && <span className="vc-message-decorations-affix">{prefix}</span>}
            {decoration.badges.map((badge, index) => (
                <DecorationBadgeView key={`${userId}-${badge.text}-${index}`} badge={badge} />
            ))}
            {suffix && <span className="vc-message-decorations-affix">{suffix}</span>}
        </span>
    );
}
