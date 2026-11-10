/**
 * Each color is available as a full CSS color in the `--color-<name>` custom property. Mirrors
 * https://github.com/saadeghi/daisyui/blob/master/packages/daisyui/functions/variables.js
 */
export const colorNames = [
  "base-100",
  "base-200",
  "base-300",
  "base-content",

  "primary",
  "primary-content",

  "secondary",
  "secondary-content",

  "accent",
  "accent-content",

  "neutral",
  "neutral-content",

  "info",
  "info-content",

  "success",
  "success-content",

  "warning",
  "warning-content",

  "error",
  "error-content"
] as const;

/**
 * Each is available as `rounded-<name>` and reads the theme's `--radius-<name>` custom property. Mirrors
 * https://github.com/saadeghi/daisyui/blob/master/packages/daisyui/functions/variables.js
 */
export const radiusNames = ["selector", "field", "box"] as const;

/**
 * Steps provided when color mixing
 *
 * Tailwind normally only provides `50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950` but I added steps every 50
 * so that color mixing could be a bit more granular. To switch back to tailwinds shade stops just remove the
 * undesired shade entries
 */
export const colorShades = {
  50: "5%",
  100: "10%",
  150: "15%",
  200: "20%",
  250: "25%",
  300: "30%",
  350: "35%",
  400: "40%",
  450: "45%",
  500: "50%",
  550: "55%",
  600: "60%",
  650: "65%",
  700: "70%",
  750: "75%",
  800: "80%",
  850: "85%",
  900: "90%",
  950: "95%"
} as const;
