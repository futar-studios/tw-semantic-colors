import { resolve } from "node:path";

import plugin, { type PluginWithConfig } from "tailwindcss/plugin";

import { colorNames, colorShades, radiusNames } from "./constants.js";
import { isDirectory, loadThemes, themeStyles } from "./theme.js";

const cssVar = (color: string) => `var(--color-${color})`;

/**
 * Mixes `color` with `against` in the oklab color space, `percent` of the result being `color`
 *
 * Tailwind applies opacity modifiers (`bg-primary-500/50`) to any theme color by wrapping it in its own `color-mix`,
 * so no alpha placeholder is needed here.
 */
const mix = (color: string, percent: string, against: string) =>
  `color-mix(in oklab, ${cssVar(color)} ${percent}, ${against})`;

/**
 * Builds colors added by `tw-semantic-colors`. Builds "mixed" color styles with a single input color. This allows
 * classes like `bg-primary-500` to work (primary is mixed 50% against base-100). Also builds "mixed" color styles with
 * 2 input colors. This allows classes like `bg-primary-500-primary-content` to work (primary is mixed 50% against
 * primary-content).
 *
 * Keys are flat (`primary-500`, not `primary: { 500 }`). DaisyUI registers `primary` as a plain string, and when a
 * string and an object share a key the plugin loaded last wins, which would make this plugin order dependent. Flat
 * keys never collide.
 */
function buildColorStyles() {
  const builtColors: Record<string, string> = {};

  for (const color1 of colorNames) {
    // Base utilities (`bg-primary`). DaisyUI registers the same value, so loading both is harmless
    builtColors[color1] = cssVar(color1);

    for (const [shade, percent] of Object.entries(colorShades)) {
      builtColors[`${color1}-${shade}`] = mix(color1, percent, cssVar("base-100"));

      for (const color2 of colorNames) {
        if (color1 === color2) {
          continue;
        }

        builtColors[`${color1}-${shade}-${color2}`] = mix(color1, percent, cssVar(color2));
      }
    }
  }

  return builtColors;
}

/** Border radii (`rounded-box`). DaisyUI registers the same values, so loading both is harmless */
function buildRadiusStyles() {
  return Object.fromEntries(radiusNames.map((name) => [name, `var(--radius-${name})`]));
}

export interface Options {
  /**
   * Folder scanned for theme files (`.css`). A file is either bare declarations (`--color-primary: red;`, one theme)
   * or one or more `{ ... }` blocks (one theme each), which may be written as DaisyUI 5's
   * `@plugin "daisyui/theme" { ... }`. DaisyUI does not need to be installed. Relative paths
   * resolve against the working directory, which is the project root when run through Vite.
   *
   * Off by default (`false`): no folder is read unless you set one. A folder that does not exist is not an error. No
   * themes are loaded and a warning with the resolved path is logged.
   */
  themes?: string | false;
}

/** Tailwind's own `PluginWithOptions` type isn't exported, so it is spelled out here */
type SemanticColorsPlugin = { (options?: Options): PluginWithConfig; __isOptionsFunction: true };

const semanticColors: SemanticColorsPlugin = plugin.withOptions<Options>(
  (options = {}) =>
    ({ addBase }) => {
      if (!options.themes) {
        return;
      }

      const directory = resolve(options.themes);
      if (!isDirectory(directory)) {
        console.warn(`[tw-semantic-colors] Theme folder not found, no themes loaded: ${directory}`);
        return;
      }

      for (const theme of loadThemes(directory)) {
        for (const rules of themeStyles(theme)) {
          addBase(rules);
        }
      }
    },
  () => ({
    theme: {
      extend: {
        colors: buildColorStyles(),
        borderRadius: buildRadiusStyles()
      }
    }
  })
);

export default semanticColors;
