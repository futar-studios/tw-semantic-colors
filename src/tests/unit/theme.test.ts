import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadThemes, parseTheme, parseThemes, themeFromOptions, themeStyles } from "@/theme";
import semanticTheme from "@/theme-plugin";

const designerExport = `
/* exported from a theme generator */
@plugin "daisyui/theme" {
  name: "airdrieLight";
  default: true;
  prefersdark: false;
  color-scheme: "light";
  --color-base-100: oklch(100% 0 0);
  --color-primary: #1472a4;
  --radius-box: 1.5rem;
}
`;

describe("parseTheme", () => {
  it("reads a DaisyUI 5 theme block", () => {
    expect(parseTheme(designerExport, "file")).toEqual({
      name: "airdrieLight",
      default: true,
      prefersdark: false,
      colorScheme: "light",
      tokens: {
        "--color-base-100": "oklch(100% 0 0)",
        "--color-primary": "#1472a4",
        "--radius-box": "1.5rem"
      }
    });
  });

  it("works without the @plugin line", () => {
    const theme = parseTheme("{ name: x; --color-primary: red; }", "file");
    expect(theme.name).toBe("x");
    expect(theme.tokens).toEqual({ "--color-primary": "red" });
  });

  it("falls back to the file name and defaults when unspecified", () => {
    const theme = parseTheme("@plugin 'daisyui/theme' { --color-primary: red; }", "brand");
    expect(theme).toMatchObject({ name: "brand", default: false, prefersdark: false });
    expect(theme.colorScheme).toBeUndefined();
  });

  it("ignores comments, including ones containing declarations", () => {
    const theme = parseTheme("{ /* --color-primary: blue; */ --color-primary: red; }", "t");
    expect(theme.tokens).toEqual({ "--color-primary": "red" });
  });

  it("reads bare declarations with no braces and no @plugin line", () => {
    expect(
      parseTheme(
        'name: "airdrieLight";\ndefault: true;\nprefersdark: false;\ncolor-scheme: "light";\n--color-base-100: oklch(100% 0 0);\n--color-primary: #1472a4;\n--radius-box: 1.5rem;',
        "file"
      )
    ).toEqual(parseTheme(designerExport, "file"));
  });

  it("reads bare declarations that are missing the final semicolon", () => {
    expect(parseTheme("--color-primary: red", "t").tokens).toEqual({ "--color-primary": "red" });
  });

  it("throws on unbalanced braces", () => {
    expect(() => parseTheme("{ --color-primary: red;", "t")).toThrow(/unbalanced/);
    expect(() => parseTheme("--color-primary: red; }", "t")).toThrow(/unbalanced/);
  });
});

describe("parseThemes", () => {
  const light =
    '@plugin "daisyui/theme" { name: "airdrieLight"; default: true; --color-primary: #1472a4; }';
  const dark =
    '@plugin "daisyui/theme" { name: "airdrieDark"; prefersdark: true; color-scheme: dark; --color-primary: #0f5a82; }';

  it("reads one theme per @plugin block", () => {
    const themes = parseThemes(`${light}\n\n${dark}`, "airdrie");
    expect(themes.map((theme) => theme.name)).toEqual(["airdrieLight", "airdrieDark"]);
    expect(themes[0]).toMatchObject({ default: true, prefersdark: false });
    expect(themes[1]).toMatchObject({ default: false, prefersdark: true, colorScheme: "dark" });
    expect(themes[1].tokens).toEqual({ "--color-primary": "#0f5a82" });
  });

  it("reads one theme per plain { } block", () => {
    const themes = parseThemes("{ name: a; --c: 1; } { name: b; --c: 2; }", "file");
    expect(themes.map((theme) => theme.name)).toEqual(["a", "b"]);
  });

  it("mixes the @plugin form and plain braces in one file", () => {
    const themes = parseThemes(`${light} { name: b; --color-primary: red; }`, "file");
    expect(themes.map((theme) => theme.name)).toEqual(["airdrieLight", "b"]);
  });

  it("ignores text and comments between blocks, and keeps each block's tokens separate", () => {
    const themes = parseThemes(
      "/* light */ { name: a; --c: 1; } /* dark { name: x; } */ @plugin 'daisyui/theme' { name: b; --d: 2; }",
      "file"
    );
    expect(themes.map((theme) => theme.tokens)).toEqual([{ "--c": "1" }, { "--d": "2" }]);
  });

  it("still returns a single theme for a single block or bare file", () => {
    expect(parseThemes("{ --c: 1; }", "solo")).toHaveLength(1);
    expect(parseThemes("--c: 1;", "solo")).toHaveLength(1);
  });

  it("requires a name for every theme when a file holds several", () => {
    expect(() => parseThemes("{ name: a; } { --c: 1; }", "file")).toThrow(/theme 2 has no name/);
  });

  it("rejects a second name: in a bare file, telling the author to use braces", () => {
    expect(() => parseThemes("name: a; --c: 1; name: b; --c: 2;", "file")).toThrow(
      /Wrap each theme in \{ \} braces/
    );
  });

  it("rejects two name: declarations in one block", () => {
    expect(() => parseThemes("{ name: a; name: b; }", "file")).toThrow(/2 name: declarations/);
  });

  it("rejects nested braces and unbalanced braces anywhere in the file", () => {
    expect(() => parseThemes("{ name: a; { } }", "file")).toThrow(/nested/);
    expect(() => parseThemes("{ name: a; } }", "file")).toThrow(/unbalanced/);
    expect(() => parseThemes("{ name: a; } { name: b;", "file")).toThrow(/unbalanced/);
  });

  it("is what parseTheme uses, and parseTheme refuses files with several themes", () => {
    expect(parseTheme(light, "file").name).toBe("airdrieLight");
    expect(() => parseTheme(`${light} ${dark}`, "airdrie")).toThrow(/2 themes, expected one/);
  });
});

describe("themeStyles", () => {
  const theme = parseTheme(designerExport, "file");

  it("selects by data-theme and by DaisyUI's theme-controller input", () => {
    const [rules] = themeStyles({ ...theme, default: false });
    expect(Object.keys(rules)).toEqual([
      ':root:has(input.theme-controller[value="airdrieLight"]:checked),[data-theme="airdrieLight"]'
    ]);
  });

  it("applies a default theme to :root", () => {
    const selector = Object.keys(themeStyles(theme)[0])[0];
    expect(selector.startsWith(":where(:root),")).toBe(true);
  });

  it("emits the tokens and color-scheme", () => {
    const [rules] = themeStyles(theme);
    expect(Object.values(rules)[0]).toEqual({
      "color-scheme": "light",
      "--color-base-100": "oklch(100% 0 0)",
      "--color-primary": "#1472a4",
      "--radius-box": "1.5rem"
    });
  });

  it("adds a prefers-color-scheme block for prefersdark themes", () => {
    const rules = themeStyles({ ...theme, prefersdark: true });
    expect(rules).toHaveLength(2);
    expect(rules[0]).toHaveProperty([
      "@media (prefers-color-scheme: dark)",
      ":root:not([data-theme])"
    ]);
  });

  it("escapes names the way DaisyUI does", () => {
    const [rules] = themeStyles({ ...theme, name: "my theme" });
    expect(Object.keys(rules)[0]).toContain('[data-theme="my\\20 theme"]');
  });
});

describe("loadThemes", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tw-semantic-colors-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reads a file that uses the @plugin line of either theme plugin", () => {
    writeFileSync(
      join(dir, "a.css"),
      '@plugin "tw-semantic-colors/theme" { name: "ours"; --color-primary: red; }'
    );
    writeFileSync(
      join(dir, "b.css"),
      '@plugin "daisyui/theme" { name: "daisy"; --color-primary: blue; }'
    );
    expect(loadThemes(dir).map((theme) => theme.name)).toEqual(["ours", "daisy"]);
  });

  it("loads every .css file in name order and ignores other files", () => {
    writeFileSync(join(dir, "b.css"), "--color-primary: blue;");
    writeFileSync(join(dir, "a.css"), "{ name: first; --color-primary: red; }");
    writeFileSync(join(dir, "notes.txt"), "not a theme");
    expect(loadThemes(dir).map((theme) => theme.name)).toEqual(["first", "b"]);
  });

  it("loads every theme from files that define several", () => {
    writeFileSync(
      join(dir, "airdrie.css"),
      "{ name: airdrieLight; --c: 1; } { name: airdrieDark; --c: 2; }"
    );
    writeFileSync(join(dir, "braze.css"), "--c: 3;");
    expect(loadThemes(dir).map((theme) => theme.name)).toEqual([
      "airdrieLight",
      "airdrieDark",
      "braze"
    ]);
  });

  it("names the file when one of several themes in it is invalid", () => {
    writeFileSync(join(dir, "airdrie.css"), "{ name: a; } { --c: 1; }");
    expect(() => loadThemes(dir)).toThrow(/airdrie\.css.*theme 2 has no name/);
  });

  describe("conflict warnings", () => {
    const spy = () => vi.spyOn(console, "warn").mockImplementation(() => {});
    afterEach(() => vi.restoreAllMocks());

    it("warns when two themes share a name, even across files", () => {
      const warn = spy();
      writeFileSync(join(dir, "a.css"), "{ name: same; --c: 1; }");
      writeFileSync(join(dir, "b.css"), "{ name: same; --c: 2; }");
      loadThemes(dir);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toContain('"same"');
    });

    it("warns once per duplicated name, however many times it repeats", () => {
      const warn = spy();
      writeFileSync(join(dir, "a.css"), "{ name: x; } { name: x; } { name: x; }");
      loadThemes(dir);
      expect(warn).toHaveBeenCalledOnce();
    });

    it("warns when several themes set default: true, and lists them", () => {
      const warn = spy();
      writeFileSync(
        join(dir, "a.css"),
        "{ name: light; default: true; } { name: dark; default: true; }"
      );
      loadThemes(dir);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toContain("light, dark");
    });

    it("stays silent for one default and one prefersdark theme", () => {
      const warn = spy();
      writeFileSync(
        join(dir, "a.css"),
        "{ name: light; default: true; } { name: dark; prefersdark: true; }"
      );
      loadThemes(dir);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it("returns no themes for a missing or empty folder", () => {
    expect(loadThemes(join(dir, "missing"))).toEqual([]);
    mkdirSync(join(dir, "empty"));
    expect(loadThemes(join(dir, "empty"))).toEqual([]);
  });

  it("names the broken file in its error", () => {
    writeFileSync(join(dir, "broken.css"), "{ --color-primary: red;");
    expect(() => loadThemes(dir)).toThrow(/broken\.css/);
  });
});

describe("themeFromOptions", () => {
  it("reads the DaisyUI 5 option keys, keeping everything else as tokens", () => {
    expect(
      themeFromOptions({
        name: "mytheme",
        default: true,
        prefersdark: true,
        "color-scheme": "dark",
        "--color-primary": "oklch(45% 0.24 277)",
        "--radius-box": "1rem"
      })
    ).toEqual({
      name: "mytheme",
      default: true,
      prefersdark: true,
      colorScheme: "dark",
      tokens: { "--color-primary": "oklch(45% 0.24 277)", "--radius-box": "1rem" }
    });
  });

  it("names the theme custom-theme, like DaisyUI, when no name is given", () => {
    expect(themeFromOptions({}).name).toBe("custom-theme");
  });

  it("accepts booleans written as strings, and turns other values into text", () => {
    const theme = themeFromOptions({ default: "true", prefersdark: "false", "--depth": 0 });
    expect(theme.default).toBe(true);
    expect(theme.prefersdark).toBe(false);
    expect(theme.tokens).toEqual({ "--depth": "0" });
  });

  it("produces the same rules as the same theme read from a file", () => {
    const fromFile = parseTheme("{ name: t; default: true; --color-primary: red; }", "x");
    const fromOptions = themeFromOptions({ name: "t", default: true, "--color-primary": "red" });
    expect(themeStyles(fromOptions)).toEqual(themeStyles(fromFile));
  });
});

describe("semanticTheme plugin", () => {
  it("is a Tailwind plugin that takes options", () => {
    expect(semanticTheme.__isOptionsFunction).toBe(true);
    expect(typeof semanticTheme({ name: "t" }).handler).toBe("function");
  });

  it("adds the theme's rules to the base layer", () => {
    const addBase = vi.fn();
    semanticTheme({ name: "t", "--color-primary": "red" }).handler({ addBase } as never);
    expect(addBase).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(addBase.mock.calls[0][0])).toContain('[data-theme=\\"t\\"]');
  });
});
