import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { DEFAULT_API_URL } from "./types";

export const settings = definePluginSettings({
    userDecorations: {
        type: OptionType.STRING,
        description: "Local badge and style configuration (JSON)",
        default: "{}"
    },
    mySecret: {
        type: OptionType.STRING,
        description: "Publishing secret key (do not share with others)",
        default: ""
    },
    autoPublish: {
        type: OptionType.BOOLEAN,
        description: "Automatically publish your changes to the network",
        default: true
    }
});
