import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

/**
 * A DaisyUI 5 compatible theme. `tokens` are CSS custom properties (`--color-primary`, `--radius-box`, ...), exactly
 * as DaisyUI's `@plugin "daisyui/theme"` block takes them.
 */
export interface ThemeDefinition {
  name: string;
  /** Applied to `:root` when no `data-theme` is set */
  default: boolean;
  /** Applied to `:root` when the user's OS prefers a dark color scheme and no `data-theme` is set */
  prefersdark: boolean;
  colorScheme?: string;
  tokens: Record<string, string>;
}

interface StyleRules {
  [selector: string]: string | StyleRules;
}

const unquote = (value: string) => value.replace(/^(["'])(.*)\1$/s, "$2");

/**
 * Returns the contents of each top-level `{ ... }` block. Text outside the braces (such as `@plugin "daisyui/theme"`)
 * is ignored.
 */
function findBlocks(source: string): Array<string> {
  const blocks: Array<string> = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < source.length; index++) {
    if (source[index] === "{") {
      if (depth > 0) {
        throw new Error("has nested { } braces, which themes do not support");
      }
      depth++;
      start = index + 1;
    } else if (source[index] === "}") {
      if (depth === 0) {
        throw new Error("has unbalanced { } braces");
      }
      depth--;
      blocks.push(source.slice(start, index));
    }
  }

  if (depth !== 0) {
    throw new Error("has unbalanced { } braces");
  }

  return blocks;
}

/** Reads one theme's declarations. `names` counts the `name:` declarations seen, so callers can reject ambiguity */
function parseDeclarations(body: string, fallbackName: string) {
  const theme: ThemeDefinition = {
    name: fallbackName,
    default: false,
    prefersdark: false,
    tokens: {}
  };
  let names = 0;

  for (const declaration of body.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = declaration.slice(0, separator).trim();
    const value = unquote(declaration.slice(separator + 1).trim());
    if (!key || !value) {
      continue;
    }

    if (key === "name") {
      theme.name = value;
      names++;
    } else if (key === "default") {
      theme.default = value === "true";
    } else if (key === "prefersdark") {
      theme.prefersdark = value === "true";
    } else if (key === "color-scheme") {
      theme.colorScheme = value;
    } else {
      theme.tokens[key] = value;
    }
  }

  return { theme, names };
}

/**
 * Parses a theme file into one or more themes. Neither form needs DaisyUI installed, because the file is only ever
 * read as text.
 *
 * Bare declarations, which make exactly one theme:
 *
 *     name: "mytheme";
 *     default: true;
 *     color-scheme: light;
 *     --color-primary: oklch(45% 0.24 277);
 *
 * Braces, with each top-level `{ ... }` block making one theme. Both of these are valid and mean the same thing:
 *
 *     @plugin "daisyui/theme" {
 *       name: "mytheme-light";
 *       --color-primary: oklch(45% 0.24 277);
 *     }
 *
 *     {
 *       name: "mytheme-light";
 *       --color-primary: oklch(45% 0.24 277);
 *     }
 *
 * The first is the block DaisyUI 5's theme generator exports, so a file from it works unchanged. The `@plugin
 * "daisyui/theme"` text is ignored, never executed, so DaisyUI does not need to be installed. Blocks can be mixed
 * freely in one file:
 *
 *     @plugin "daisyui/theme" {
 *       name: "mytheme-light";
 *       --color-primary: oklch(45% 0.24 277);
 *     }
 *     {
 *       name: "mytheme-dark";
 *       --color-primary: oklch(65% 0.2 277);
 *     }
 *
 * A theme without a `name` is named `fallbackName` (normally the file name), but only when it is the file's only
 * theme, since several themes cannot share one name. Without braces there is no way to tell where one theme ends and
 * the next begins, so a second `name:` in a bare file is an error.
 */
export function parseThemes(source: string, fallbackName: string): Array<ThemeDefinition> {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = findBlocks(withoutComments);
  const bodies = blocks.length > 0 ? blocks : [withoutComments];

  return bodies.map((body, index) => {
    const { theme, names } = parseDeclarations(body, fallbackName);

    if (names > 1) {
      throw new Error(
        blocks.length > 0
          ? `has a theme with ${names} name: declarations`
          : `has ${names} name: declarations. Wrap each theme in { } braces to put several in one file`
      );
    }
    if (bodies.length > 1 && names === 0) {
      throw new Error(`has ${bodies.length} themes but theme ${index + 1} has no name:`);
    }

    return theme;
  });
}

/** Parses a file that must hold exactly one theme */
export function parseTheme(source: string, fallbackName: string): ThemeDefinition {
  const themes = parseThemes(source, fallbackName);
  if (themes.length !== 1) {
    throw new Error(`Theme "${fallbackName}" has ${themes.length} themes, expected one`);
  }
  return themes[0];
}

/**
 * Builds a theme from the options of an `@plugin "tw-semantic-colors/theme" { ... }` block. Tailwind has already parsed
 * the values by then (`default: true` is a boolean, `--color-primary: red` a string), so booleans are accepted as
 * either, and anything else is written to the stylesheet as text.
 */
export function themeFromOptions(options: Record<string, unknown>): ThemeDefinition {
  const {
    name = "custom-theme",
    default: isDefault,
    prefersdark,
    "color-scheme": colorScheme,
    ...rest
  } = options;
  const isTrue = (value: unknown) => value === true || value === "true";

  return {
    name: String(name),
    default: isTrue(isDefault),
    prefersdark: isTrue(prefersdark),
    colorScheme: colorScheme === undefined ? undefined : String(colorScheme),
    tokens: Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, String(value)]))
  };
}

const escapeCssString = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]/gu, (character) => `\\${character.codePointAt(0)!.toString(16)} `);

/**
 * Builds the rules DaisyUI's `daisyui/theme` plugin emits for a theme, so DaisyUI components, `theme-controller` inputs
 * and `theme-change` all work with it:
 *
 *  - `[data-theme="<name>"]` and `:root:has(input.theme-controller[value="<name>"]:checked)` select the theme
 *  - `default` also applies it to `:where(:root)`
 *  - `prefersdark` also applies it under `prefers-color-scheme: dark` when no `data-theme` is set
 */
export function themeStyles(theme: ThemeDefinition): Array<StyleRules> {
  const name = escapeCssString(theme.name);
  const selector = `:root:has(input.theme-controller[value="${name}"]:checked),[data-theme="${name}"]`;
  const declarations = { "color-scheme": theme.colorScheme ?? "normal", ...theme.tokens };

  const rules: Array<StyleRules> = [
    { [theme.default ? `:where(:root),${selector}` : selector]: declarations }
  ];

  if (theme.prefersdark) {
    rules.unshift({
      "@media (prefers-color-scheme: dark)": { ":root:not([data-theme])": declarations }
    });
  }

  return rules;
}

/** Whether `path` exists and is a folder. Never throws */
export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Warns about themes whose rules would fight each other. Neither is fatal, the theme loaded last wins */
function warnAboutConflicts(themes: Array<ThemeDefinition>) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { name } of themes) {
    (seen.has(name) ? duplicates : seen).add(name);
  }
  for (const name of duplicates) {
    console.warn(
      `[tw-semantic-colors] Several themes are named "${name}", the one loaded last wins`
    );
  }

  const defaults = themes.filter((theme) => theme.default).map((theme) => theme.name);
  if (defaults.length > 1) {
    console.warn(
      `[tw-semantic-colors] Several themes set default: true (${defaults.join(", ")}), the one loaded last wins`
    );
  }
}

/**
 * Reads every `.css` file in `directory` as one or more themes, in file name order. A missing directory (or a path
 * that is not a folder) means no themes.
 */
export function loadThemes(directory: string): Array<ThemeDefinition> {
  if (!isDirectory(directory)) {
    return [];
  }

  const themes = readdirSync(directory)
    .filter((file) => extname(file) === ".css")
    .sort()
    .flatMap((file) => {
      try {
        return parseThemes(readFileSync(join(directory, file), "utf8"), basename(file, ".css"));
      } catch (error) {
        throw new Error(`Failed to load theme file "${file}": ${(error as Error).message}`);
      }
    });

  warnAboutConflicts(themes);
  return themes;
}
