import plugin from "@/lib";

/** The flat `theme.extend.colors` object the plugin adds to Tailwind's config. */
export const colors = plugin().config!.theme!.extend!.colors as Record<string, string | undefined>;
