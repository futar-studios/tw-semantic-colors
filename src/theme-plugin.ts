import plugin, { type PluginWithConfig } from "tailwindcss/plugin";

import { themeFromOptions, themeStyles } from "./theme.js";

/**
 * Options of `@plugin "tw-semantic-colors/theme" { ... }`. The same keys as DaisyUI 5's `@plugin "daisyui/theme"`, and
 * every other key (`--color-primary`, `--radius-box`, ...) is a value the theme defines.
 */
export interface ThemeOptions {
  /** Theme name, selected with `data-theme="<name>"`. Defaults to `custom-theme` */
  name?: string;
  /** Applied to `:root` when no theme is selected */
  default?: boolean;
  /** Applied when the user's system prefers dark and no theme is selected */
  prefersdark?: boolean;
  "color-scheme"?: string;
  [token: string]: string | boolean | undefined;
}

/** Tailwind's own `PluginWithOptions` type isn't exported, so it is spelled out here */
type ThemePlugin = { (options?: ThemeOptions): PluginWithConfig; __isOptionsFunction: true };

/**
 * Declares one theme in your CSS, like DaisyUI's `@plugin "daisyui/theme"` but without needing DaisyUI. Unlike the
 * `themes` folder option, Tailwind watches the CSS file, so editing a theme applies without restarting the dev server.
 */
const semanticTheme: ThemePlugin = plugin.withOptions<ThemeOptions>(
  (options = {}) =>
    ({ addBase }) => {
      for (const rules of themeStyles(themeFromOptions(options))) {
        addBase(rules);
      }
    }
);

export default semanticTheme;
