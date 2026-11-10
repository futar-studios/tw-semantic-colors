import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { colorNames, colorShades, radiusNames } from "@/constants";
import plugin from "@/lib";
import { colors } from "../helpers";

describe("plugin", () => {
  it("mixes each shade against base-100", () => {
    expect(colors["primary-500"]).toBe(
      "color-mix(in oklab, var(--color-primary) 50%, var(--color-base-100))"
    );
  });

  it("adds every shade for every semantic color", () => {
    for (const color of colorNames) {
      for (const shade of Object.keys(colorShades)) {
        expect(colors[`${color}-${shade}`]).toContain("color-mix(");
      }
    }
  });

  it("mixes a shade against another color, but never against itself", () => {
    expect(colors["primary-500-primary-content"]).toBe(
      "color-mix(in oklab, var(--color-primary) 50%, var(--color-primary-content))"
    );
    expect(colors).not.toHaveProperty("primary-500-primary");
  });

  it("registers each base semantic color with the same value DaisyUI uses", () => {
    for (const color of colorNames) {
      expect(colors[color]).toBe(`var(--color-${color})`);
    }
  });

  it("uses flat keys so it cannot clash with DaisyUI's own color entries", () => {
    for (const value of Object.values(colors)) {
      expect(typeof value).toBe("string");
    }
  });

  it("does not use DaisyUI 4 variables or Tailwind 3 alpha placeholders", () => {
    const serialized = JSON.stringify(colors);
    expect(serialized).not.toContain("<alpha-value>");
    expect(serialized).not.toContain("--fallback");
    expect(serialized).not.toMatch(/var\(--(p|pc|s|sc|a|ac|n|nc|b1|b2|b3|bc)\b/);
  });
});

describe("plugin border radii", () => {
  const radii = plugin().config!.theme!.extend!.borderRadius;

  it("registers each radius with the same value DaisyUI uses", () => {
    expect(radii).toEqual({
      selector: "var(--radius-selector)",
      field: "var(--radius-field)",
      box: "var(--radius-box)"
    });
    expect(Object.keys(radii as object)).toEqual([...radiusNames]);
  });

  it("maps every radius name to its own --radius-<name> variable", () => {
    for (const name of radiusNames) {
      expect(radii).toHaveProperty(name, `var(--radius-${name})`);
    }
  });

  it("does not use DaisyUI 4's --rounded-* variables", () => {
    expect(JSON.stringify(radii)).not.toContain("--rounded");
  });

  it("does not collide with Tailwind's built-in rounded sizes", () => {
    for (const name of ["none", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full"]) {
      expect(radii).not.toHaveProperty(name);
    }
  });
});

describe("plugin themes option", () => {
  function addedBase(options?: Parameters<typeof plugin>[0]) {
    const addBase = vi.fn();
    plugin(options).handler({ addBase } as never);
    return addBase;
  }

  it("adds each theme in the folder to the base layer", () => {
    const dir = mkdtempSync(join(tmpdir(), "tw-semantic-colors-"));
    try {
      writeFileSync(join(dir, "a.css"), "{ --color-primary: red; }");
      writeFileSync(join(dir, "b.css"), "{ --color-primary: blue; }");
      expect(addedBase({ themes: dir })).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("by default", () => {
    it("loads no themes even if a ./themes folder exists, and does not warn", () => {
      const dir = mkdtempSync(join(tmpdir(), "tw-semantic-colors-"));
      try {
        mkdirSync(join(dir, "themes"));
        writeFileSync(join(dir, "themes", "a.css"), "{ --color-primary: red; }");
        vi.spyOn(process, "cwd").mockReturnValue(dir);
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        expect(addedBase()).not.toHaveBeenCalled();
        expect(addedBase({})).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();

        // ...but the same folder loads once it is asked for, resolved against the working directory
        expect(addedBase({ themes: "./themes" })).toHaveBeenCalledOnce();
      } finally {
        vi.restoreAllMocks();
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("when the folder cannot be found", () => {
    const warn = () => vi.spyOn(console, "warn").mockImplementation(() => {});
    afterEach(() => vi.restoreAllMocks());

    it("adds nothing, does not throw, and warns with the resolved path", () => {
      const spy = warn();
      expect(addedBase({ themes: "/nonexistent/themes" })).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toContain("/nonexistent/themes");
    });

    it("treats a path that is a file, not a folder, the same way", () => {
      const dir = mkdtempSync(join(tmpdir(), "tw-semantic-colors-"));
      try {
        const file = join(dir, "themes");
        writeFileSync(file, "not a folder");
        const spy = warn();
        expect(addedBase({ themes: file })).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledOnce();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("stays silent with `themes: false`", () => {
      const spy = warn();
      addedBase({ themes: false });
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
