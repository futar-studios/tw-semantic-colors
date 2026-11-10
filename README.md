# tw-semantic-colors

Add semantic colors to Tailwind 4.

This plugin was heavily inspired by [DaisyUI 5](https://daisyui.com), it is compatible with it, but it is NOT required!

- **Semantic colors:** `bg-primary`, `text-base-content`, `rounded-box`. Colors are defined by themes, so changing the
  theme changes what `bg-primary` means.
- **Color mixing:** shades like `bg-primary-500` mix a color with another, in the style of
  [daisy-ext](https://github.com/nfaucher8/daisy-ext).
- **Theme loader:** load themes from a folder of CSS files and switch between them with `data-theme`.

## Install

```bash
pnpm add tw-semantic-colors
```

Requires `tailwindcss` 4. `daisyui` 5 is an optional peer dependency.

## Use

Add the plugin to your CSS:

```css
@import "tailwindcss";
@plugin "tw-semantic-colors";
```

It can be used alone or next to DaisyUI, in either order:

```css
@plugin "daisyui";
@plugin "tw-semantic-colors";
```

## Utilities

Every semantic color works with every Tailwind color utility (`bg-`, `text-`, `border-`, `ring-`, ...).

| Class                                            | Result                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `bg-primary`                                     | The theme's `--color-primary`                                     |
| `bg-primary-500`                                 | `primary` mixed 50% with `base-100`                               |
| `bg-primary-500-primary-content`                 | `primary` mixed 50% with `primary-content`                        |
| `bg-primary-500/50`                              | Any of the above with an opacity modifier                         |
| `rounded-box` `rounded-field` `rounded-selector` | The theme's `--radius-box`, `--radius-field`, `--radius-selector` |

- **Colors:** `base-100`, `base-200`, `base-300`, `base-content`, and `primary`, `secondary`, `accent`, `neutral`,
  `info`, `success`, `warning`, `error`, each with a `-content` variant.
- **Shades:** `50` to `950` in steps of 50. The number is the percentage of the color in the mix.
- **Mixes:** `<color>-<shade>-<other color>` mixes against another semantic color instead of `base-100`. A color is
  never mixed with itself.

## Themes

A theme defines the colors used by the utility classes above. Themes can be automatically loaded from a folder using the
following syntax:

```css
@plugin "tw-semantic-colors" {
  themes: "./src/themes";
}
```

Put one `.css` file per brand or theme in that folder. New files appear without editing your CSS. Restart the dev
server after adding, removing or editing a theme file, because plugins are not watched.

The path is relative to the working directory, which is the project root when run through Vite. If the folder does not
exist, no themes are loaded and a warning with the resolved path is logged.

### Declaring a theme in your CSS

A theme can also be declared directly in your CSS with `tw-semantic-colors/theme`, which takes the same block as
DaisyUI 5's `@plugin "daisyui/theme"` but does not need DaisyUI:

```css
@plugin "tw-semantic-colors/theme" {
  name: "mytheme-light";
  default: true;
  color-scheme: light;
  --color-base-100: oklch(100% 0 0);
  --color-primary: oklch(45% 0.24 277);
}
```

Use one block per theme. Unlike the theme folder, Tailwind watches your CSS file, so editing a theme applies without
restarting the dev server. It takes the keys in the table below.

### Theme files

DaisyUI does not need to be installed. Files are only read as text. All of these are valid:

**A block in DaisyUI 5's own format.** A file from DaisyUI's theme generator works unchanged, and so does
`@plugin "tw-semantic-colors/theme"` in its place:

```css
@plugin "daisyui/theme" {
  name: "mytheme-light";
  default: true;
  color-scheme: light;
  --color-base-100: oklch(100% 0 0);
  --color-primary: oklch(45% 0.24 277);
  --radius-box: 1.5rem;
}
```

**A plain block**, the same thing without the `@plugin` line:

```css
{
  name: "mytheme-light";
  --color-primary: oklch(45% 0.24 277);
}
```

**Bare declarations**, for a file with a single theme:

```css
name: "mytheme-light";
--color-primary: oklch(45% 0.24 277);
```

**Several themes in one file**, using either block form, and the two can be mixed:

```css
@plugin "daisyui/theme" {
  name: "mytheme-light";
  default: true;
  --color-primary: oklch(45% 0.24 277);
}

{
  name: "mytheme-dark";
  prefersdark: true;
  color-scheme: dark;
  --color-primary: oklch(65% 0.2 277);
}
```

Bare declarations cannot hold several themes, because there is nothing to say where one ends. A second `name:` in a
bare file is an error.

| Key                             | Meaning                                                                   |
| ------------------------------- | ------------------------------------------------------------------------- |
| `name`                          | Theme name. Defaults to the file name, but only for a file with one theme |
| `default: true`                 | Applied to the page when no theme is selected                             |
| `prefersdark: true`             | Applied when the user's system prefers dark and no theme is selected      |
| `color-scheme`                  | `light` or `dark`                                                         |
| `--color-*`, `--radius-*`, etc. | The values the theme defines                                              |

These keys are not validated as CSS. Anything that is not one of the first four is written to the stylesheet as is, so
a misspelled key is silently ignored by the browser.

DaisyUI's own themes define every color explicitly, and this plugin does not derive any for you, so define all of them:
`--color-base-100`, `-200`, `-300`, `-content`, and each color with its `-content` color.

Several themes with the same name, or several with `default: true`, log a warning. The last one loaded wins.

Files in the themes folder are parsed by JS and read as text, so never `@import` them as well, because the theme would
be emitted twice.

### Switching themes

A theme is selected with `data-theme="<name>"` on any element, usually `<html>`:

```html
<html data-theme="mytheme-dark"></html>
```

This is the same selector DaisyUI uses, so DaisyUI's `theme-controller` inputs work, and so does
[`theme-change`](https://github.com/saadeghi/theme-change), which only sets `data-theme` and remembers the choice.

## Compatibility with DaisyUI

The base color and radius utilities are registered with the same values DaisyUI 5 uses, so loading both is harmless in
either order. Themes emit the same selectors and variables as `@plugin "daisyui/theme"`.

While the utility classes provide no benefit to a project that already uses DaisyUI, you can add this plugin to enable
color mixing (the same way [daisy-ext](https://github.com/nfaucher8/daisy-ext) provided color mixing for Tailwind 3 and
DaisyUI 4).

This plugin can also be used to enable loading custom theme `.css` files from a specified theme folder.

## Development

```bash
pnpm test        # unit, property and integration tests
pnpm build   # type-check and build to dist/
pnpm lint:check && pnpm format:check && pnpm typecheck
```
