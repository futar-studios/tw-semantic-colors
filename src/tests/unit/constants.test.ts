import { describe, expect, it } from "vitest";

import { colorNames, colorShades, radiusNames } from "@/constants";

describe("colorNames", () => {
  it("has no duplicates", () => {
    expect(new Set(colorNames).size).toBe(colorNames.length);
  });

  it("only contains kebab-case names", () => {
    for (const name of colorNames) {
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("includes every DaisyUI 5 semantic color", () => {
    for (const base of [
      "primary",
      "secondary",
      "accent",
      "neutral",
      "info",
      "success",
      "warning",
      "error"
    ]) {
      expect(colorNames).toContain(base);
      expect(colorNames).toContain(`${base}-content`);
    }
    for (const name of ["base-100", "base-200", "base-300", "base-content"]) {
      expect(colorNames).toContain(name);
    }
  });
});

describe("radiusNames", () => {
  it("has no duplicates", () => {
    expect(new Set(radiusNames).size).toBe(radiusNames.length);
  });

  it("only contains kebab-case names", () => {
    for (const name of radiusNames) {
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("includes every DaisyUI 5 radius", () => {
    expect([...radiusNames].sort()).toEqual(["box", "field", "selector"]);
  });

  it("does not overlap with the color names", () => {
    for (const name of radiusNames) {
      expect(colorNames).not.toContain(name);
    }
  });
});

describe("colorShades", () => {
  it("steps every 50 from 50 to 950", () => {
    const shades = Object.keys(colorShades).map(Number);
    expect(shades[0]).toBe(50);
    expect(shades[shades.length - 1]).toBe(950);
    shades.slice(1).forEach((shade, i) => expect(shade - shades[i]).toBe(50));
  });

  it("uses a percentage equal to shade / 10", () => {
    for (const [shade, percent] of Object.entries(colorShades)) {
      expect(percent).toBe(`${Number(shade) / 10}%`);
    }
  });
});
