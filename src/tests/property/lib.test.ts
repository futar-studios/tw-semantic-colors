import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { colorNames, colorShades } from "@/constants";
import { colors } from "../helpers";

const colorArb = fc.constantFrom(...colorNames);
const shadeArb = fc.constantFrom(
  ...(Object.keys(colorShades).map(Number) as Array<keyof typeof colorShades>)
);

describe("plugin color properties", () => {
  it("single-color shades mix the color against base-100 at the shade percentage", () => {
    fc.assert(
      fc.property(colorArb, shadeArb, (color, shade) => {
        expect(colors[`${color}-${shade}`]).toBe(
          `color-mix(in oklab, var(--color-${color}) ${colorShades[shade]}, var(--color-base-100))`
        );
      })
    );
  });

  it("two-color shades mix both colors, and are only defined for distinct colors", () => {
    fc.assert(
      fc.property(colorArb, colorArb, shadeArb, (a, b, shade) => {
        const value = colors[`${a}-${shade}-${b}`];
        if (a === b) {
          expect(value).toBeUndefined();
        } else {
          expect(value).toBe(
            `color-mix(in oklab, var(--color-${a}) ${colorShades[shade]}, var(--color-${b}))`
          );
        }
      })
    );
  });
});
