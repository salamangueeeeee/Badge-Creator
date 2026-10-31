/*
 * Vencord - Badge Creator (MessageDecorations)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { showNotification } from "@api/Notifications";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { useForceUpdater } from "@utils/react";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { Menu, openModal, React, useEffect, useRef, UserStore } from "@webpack/common";

import { DecorationBadgeView, DecorationCluster } from "./components/BadgeView";
import { DecorationEditorModal } from "./components/EditorModal";
import { settings } from "./settings";
import {
    ensureSecret,
    fetchRemoteConfig,
    getDecoration,
    getSyncState,
    publishMyDecoration,
    startPolling,
    stopPolling,
    subscribe,
    triggerBackgroundFetch
} from "./store";
import { DecorationBadge, NameAnimation, UserDecoration } from "./types";

const CustomizationSection = findComponentByCodeLazy(".DESCRIPTION", "hasBackground:");
const PROFILE_BADGE_ID = "message-decorations-profile-badges";

function useLiveConfig() {
    const update = useForceUpdater();
    useEffect(() => subscribe(update), [update]);
}

const NAME_ANIM_CLASSES: Record<NameAnimation, string> = {
    none: "",
    pulse: "vc-message-decorations-name-pulse",
    rainbow: "vc-message-decorations-name-rainbow",
    shine: "vc-message-decorations-name-shine"
};

function applyNameEffects(from: HTMLElement | null, decoration: UserDecoration | undefined) {
    const row = from?.closest(".vc-message-decorations-wrapper")?.parentElement;
    const username = row?.querySelector<HTMLElement>("[class*='username']");
    if (!username) return () => { };

    const applied = Object.values(NAME_ANIM_CLASSES).filter(Boolean);
    username.classList.remove(...applied);
    if (decoration?.nameAnimation && decoration.nameAnimation !== "none") {
        username.classList.add(NAME_ANIM_CLASSES[decoration.nameAnimation]);
    }
    username.style.textShadow = decoration?.nameGlow ? `0 0 10px ${decoration.nameGlow}` : "";

    return () => {
        username.classList.remove(...applied);
        username.style.textShadow = "";
    };
}

function MessageDecoration({ userId }: { userId: string; }) {
    useLiveConfig();
    const ref = useRef<HTMLSpanElement>(null);
    const decoration = getDecoration(userId);

    useEffect(() => applyNameEffects(ref.current, decoration), [decoration]);

    if (!decoration) return null;
    return (
        <ErrorBoundary>
            <span ref={ref}>
                <DecorationCluster decoration={decoration} userId={userId} />
            </span>
        </ErrorBoundary>
    );
}

interface ProfileDecorationBadgeProps extends ProfileBadge {
    decorationBadge?: DecorationBadge;
}

function ProfileDecorationBadge(props: ProfileDecorationBadgeProps) {
    const badge = props.decorationBadge;
    if (!badge) return null;
    return <DecorationBadgeView badge={badge} />;
}

const profileBadgeProvider: ProfileBadge = {
    id: PROFILE_BADGE_ID,
    position: BadgePosition.END,

    getBadges({ userId }) {
        const decoration = getDecoration(userId);
        if (!decoration) return [];

        return decoration.badges.map((badge, index) => ({
            id: `${PROFILE_BADGE_ID}-${userId}-${index}`,
            key: badge.text,
            description: badge.text,
            component: ProfileDecorationBadge,
            decorationBadge: badge
        } as ProfileDecorationBadgeProps));
    }
};

export function openDecorationStudio() {
    openModal(modalProps => (
        <DecorationEditorModal modalProps={modalProps} />
    ));
}

function SettingsPanel() {
    useLiveConfig();
    const me = UserStore.getCurrentUser();
    const decoration = me ? getDecoration(me.id) : undefined;
    const sync = getSyncState();

    return (
        <div className="md-card" style={{ marginBottom: 12 }}>
            <div className="md-head">
                <div className="md-head-text">
                    <div className="md-head-title">Badge Creator</div>
                    <div className="md-head-line">
                        {sync.count} user profile{sync.count === 1 ? "" : "s"} live on the network
                    </div>
                </div>
                <span className={`md-status md-status-${sync.state}`}>
                    <span className="md-status-dot" />
                    {sync.state === "good" ? "Online" : sync.state === "waiting" ? "Syncing…" : "Offline"}
                </span>
            </div>
            <p className="md-copy">
                Voice Radar-style visual studio. Create custom animated badges, gradient colors, aura glow and glowing username styles shared across all plugin users.
            </p>
            {decoration && me && <DecorationCluster decoration={decoration} userId={me.id} />}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <Button size="small" variant="primary" onClick={openDecorationStudio}>Open Badge Creator</Button>
                <Button
                    size="small"
                    variant="secondary"
                    onClick={async () => {
                        try {
                            await publishMyDecoration();
                            showNotification({ title: "Badge Creator", body: "Style successfully published to the network!" });
                        } catch (error: any) {
                            showNotification({ title: "Badge Creator", body: error?.message || "Failed to publish" });
                        }
                    }}
                >
                    Publish
                </Button>
                <Button size="small" variant="secondary" onClick={() => void fetchRemoteConfig(true)}>Refresh</Button>
            </div>
        </div>
    );
}

function MessageDecorationsSection() {
    return (
        <CustomizationSection title="Badge Creator" hasBackground={true}>
            <div className="vc-message-decorations-profile-section">
                <p>
                    Customize animated badges, glow, gradients, prefix/suffix and custom username colors.
                    Publish once and all plugin users will see your style in chat.
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <Button size="small" variant="primary" onClick={openDecorationStudio}>Open Badge Creator</Button>
                    <Button
                        size="small"
                        variant="secondary"
                        onClick={async () => {
                            try {
                                await publishMyDecoration();
                                showNotification({ title: "Badge Creator", body: "Style successfully published!" });
                            } catch (error: any) {
                                showNotification({ title: "Badge Creator", body: error?.message || "Failed to publish" });
                            }
                        }}
                    >
                        Publish
                    </Button>
                    <Button size="small" variant="secondary" onClick={() => void fetchRemoteConfig(true)}>Refresh</Button>
                </div>
            </div>
        </CustomizationSection>
    );
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: { user: any; }) => {
    const me = UserStore.getCurrentUser();
    if (!user || (user.id !== me?.id && !user.isCurrentUser)) return;

    const item = (
        <Menu.MenuItem
            id="vc-message-decorations-studio"
            label="Badge Creator"
            action={openDecorationStudio}
        />
    );

    if (Array.isArray(children)) {
        const last = children[children.length - 1];
        if (last && Array.isArray(last.props?.children)) {
            last.props.children.push(item);
        } else {
            children.push(item);
        }
    }
};

export default definePlugin({
    name: "MessageDecorations",
    description: "Design custom animated badges, gradients, aura glow & username styles shared across all plugin users.",
    authors: [{ name: "Salamangue", id: 0n }],
    settings,
    settingsAboutComponent: () => <SettingsPanel />,
    toolboxActions: {
        "Badge Creator": openDecorationStudio
    },
    commands: [
        {
            name: "badgecreator",
            description: "Open Badge Creator",
            execute: () => {
                openDecorationStudio();
            }
        },
        {
            name: "badges",
            description: "Open Badge Creator",
            execute: () => {
                openDecorationStudio();
            }
        },
        {
            name: "decorations",
            description: "Open Badge Creator",
            execute: () => {
                openDecorationStudio();
            }
        }
    ],
    contextMenus: {
        "user-context": UserContextMenuPatch,
        "user-profile-actions": UserContextMenuPatch
    },

    patches: [
        {
            find: "DefaultCustomizationSections",
            replacement: {
                match: /(?<=#{intl::USER_SETTINGS_AVATAR_DECORATION}\)},"decoration"\),)/,
                replace: "$self.MessageDecorationsSection(),"
            }
        },
        {
            find: '="SYSTEM_TAG"',
            replacement: {
                match: /(?<=colorString:\i,colorStrings:\i,colorRoleName:\i.*?}=)(\i),/,
                replace: "$self.wrapMessageColorProps($1, arguments[0]),"
            }
        },
        {
            find: "#{intl::GUILD_OWNER}),children:",
            replacement: {
                match: /(?<=roleName:\i,)colorString:/,
                replace: "colorString:$self.calculateNameColorForListContext(arguments[0]),originalColor:"
            }
        }
    ],

    renderMessageDecoration(props: any) {
        const userId = props.message?.author?.id;
        if (!userId) return null;
        if (!getDecoration(userId)) {
            triggerBackgroundFetch();
        }
        return <MessageDecoration userId={userId} />;
    },

    start() {
        ensureSecret();
        addProfileBadge(profileBadgeProvider);
        startPolling();
    },

    stop() {
        stopPolling();
        removeProfileBadge(profileBadgeProvider);
    },

    MessageDecorationsSection: ErrorBoundary.wrap(MessageDecorationsSection, { noop: true }),

    wrapMessageColorProps(colorProps: any, context: any) {
        try {
            const userId = context?.message?.author?.id;
            const deco = getDecoration(userId);
            if (!deco) return colorProps;

            const gradient = deco.nameGradient?.filter(Boolean) ?? [];
            const color = gradient[0] ?? deco.nameColor;
            if (!color) return colorProps;

            return {
                ...colorProps,
                colorString: color,
                colorStrings: colorProps?.colorStrings && {
                    primaryColor: color,
                    secondaryColor: gradient[1],
                    tertiaryColor: gradient[2]
                }
            };
        } catch {
            return colorProps;
        }
    },

    calculateNameColorForListContext(context: any) {
        try {
            const deco = getDecoration(context?.user?.id);
            return deco?.nameGradient?.[0] ?? deco?.nameColor ?? context?.colorString;
        } catch {
            return context?.colorString;
        }
    }
});
