import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import daisyui from "daisyui";
import daisyTheme from "daisyui/theme";
import { compile } from "tailwindcss";
import { afterEach, describe, expect, it } from "vitest";

import { colorNames } from "@/constants";
import plugin from "@/lib";
import themePlugin from "@/theme-plugin";

const modules = {
  daisyui,
  "daisyui/theme": daisyTheme,
  "tw-semantic-colors": plugin,
  "tw-semantic-colors/theme": themePlugin
};

async function generate(plugins: Array<keyof typeof modules>, ...candidates: Array<string>) {
  const css = plugins.map((name) => `@plugin "${name}";`).join(" ") + " @tailwind utilities;";
  const compiler = await compile(css, {
    loadModule: async (id) => ({ module: modules[id], base: process.cwd(), path: "" })
  });
  return compiler.build(candidates);
}

describe("without DaisyUI", () => {
  const generateWithout = (...candidates: Array<string>) =>
    generate(["tw-semantic-colors"], ...candidates);

  it("generates the base semantic color utilities for every color", async () => {
    const css = await generateWithout(...colorNames.map((color) => `bg-${color}`));
    for (const color of colorNames) {
      expect(css).toMatch(
        new RegExp(`\\.bg-${color}\\s*{\\s*background-color: var\\(--color-${color}\\)`)
      );
    }
  });

  it("generates the border radius utilities", async () => {
    const css = await generateWithout("rounded-box", "rounded-field", "rounded-t-selector");
    expect(css).toContain("border-radius: var(--radius-box)");
    expect(css).toContain("border-radius: var(--radius-field)");
    expect(css).toContain("border-top-left-radius: var(--radius-selector)");
  });

  it("generates shade classes", async () => {
    const css = await generateWithout("bg-primary-500");
    expect(css).toContain(".bg-primary-500");
    expect(css).toContain("color-mix(in oklab, var(--color-primary) 50%, var(--color-base-100))");
  });

  it("generates two-color mixed classes", async () => {
    const css = await generateWithout("text-primary-500-primary-content");
    expect(css).toContain(".text-primary-500-primary-content");
    expect(css).toContain("var(--color-primary-content)");
  });

  it("supports opacity modifiers on shades", async () => {
    const css = await generateWithout("bg-primary-500/50");
    expect(css).toContain(".bg-primary-500\\/50");
    expect(css).toContain("50%, transparent");
  });

  it("ignores classes that do not exist", async () => {
    const css = await generateWithout("bg-primary-500-primary");
    expect(css).not.toContain(".bg-primary-500-primary");
  });
});

describe("with DaisyUI", () => {
  const generateWith = (...candidates: Array<string>) =>
    generate(["daisyui", "tw-semantic-colors"], ...candidates);

  it("does not error and still generates DaisyUI's own classes", async () => {
    const css = await generateWith("bg-primary", "bg-base-200", "btn");
    expect(css).toContain(".bg-primary");
    expect(css).toContain(".btn");
  });

  it("generates our shade classes alongside DaisyUI's", async () => {
    const css = await generateWith(
      "bg-primary",
      "bg-primary-500",
      "text-primary-500-primary-content"
    );
    expect(css).toContain(".bg-primary-500");
    expect(css).toContain(".text-primary-500-primary-content");
  });

  it("generates border radius utilities that DaisyUI's themes define", async () => {
    const css = await generateWith("rounded-box");
    expect(css).toContain("border-radius: var(--radius-box)");
    expect(css).toContain("--radius-box:");
  });

  it("is order independent", async () => {
    const css = await generate(["tw-semantic-colors", "daisyui"], "bg-primary-500", "btn");
    expect(css).toContain(".bg-primary-500");
    expect(css).toContain(".btn");
  });

  it("only references variables that DaisyUI defines", async () => {
    const css = await generateWith(...colorNames.map((color) => `bg-${color}-500`));
    const defined = new Set([...css.matchAll(/(--color-[a-z0-9-]+):/g)].map((match) => match[1]));
    const used = new Set(
      [...css.matchAll(/var\((--color-[a-z0-9-]+)\)/g)].map((match) => match[1])
    );
    expect(used.size).toBeGreaterThan(0);
    for (const variable of used) {
      expect(defined, `${variable} is not defined by DaisyUI`).toContain(variable);
    }
  });
});

describe("theme folder", () => {
  const dirs: Array<string> = [];
  const makeThemes = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "tw-semantic-colors-"));
    dirs.push(dir);
    for (const [file, content] of Object.entries(files)) {
      writeFileSync(join(dir, file), content);
    }
    return dir;
  };
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  async function generateWithThemes(
    dir: string | false,
    pluginNames: Array<string>,
    ...candidates: Array<string>
  ) {
    const css =
      pluginNames
        .map(
          (name) =>
            `@plugin "${name}"${name === "tw-semantic-colors" ? ` { themes: ${dir === false ? "false" : `"${dir}"`}; }` : ";"}`
        )
        .join(" ") + " @tailwind utilities;";
    const compiler = await compile(css, {
      loadModule: async (id) => ({ module: modules[id], base: process.cwd(), path: "" })
    });
    return compiler.build(candidates);
  }

  it("emits a theme for every file in the folder, without linking each one", async () => {
    const dir = makeThemes({
      "airdrie-light.css":
        '@plugin "daisyui/theme" { name: "airdrieLight"; --color-primary: #1472a4; }',
      "braze-dark.css":
        '@plugin "daisyui/theme" { name: "brazeDark"; color-scheme: dark; --color-primary: #25358d; }'
    });
    const css = await generateWithThemes(dir, ["tw-semantic-colors"], "bg-primary");
    expect(css).toContain('[data-theme="airdrieLight"]');
    expect(css).toContain("--color-primary: #1472a4");
    expect(css).toContain('[data-theme="brazeDark"]');
    expect(css).toContain("color-scheme: dark");
  });

  it("emits every theme from a single file, mixing the @plugin and brace forms", async () => {
    const dir = makeThemes({
      "airdrie.css": `
        @plugin "daisyui/theme" { name: "airdrieLight"; default: true; --color-primary: #1472a4; }
        { name: "airdrieDark"; prefersdark: true; color-scheme: dark; --color-primary: #0f5a82; }
      `
    });
    const css = await generateWithThemes(dir, ["tw-semantic-colors"], "bg-primary");
    expect(css).toContain('[data-theme="airdrieLight"]');
    expect(css).toContain("--color-primary: #1472a4");
    expect(css).toContain('[data-theme="airdrieDark"]');
    expect(css).toContain("--color-primary: #0f5a82");
    expect(css).toContain("prefers-color-scheme: dark");
  });

  it("makes bg-primary resolve through the theme's variable", async () => {
    const dir = makeThemes({ "t.css": "{ name: t; --color-primary: #1472a4; }" });
    const css = await generateWithThemes(dir, ["tw-semantic-colors"], "bg-primary");
    expect(css).toMatch(/\.bg-primary\s*{\s*background-color: var\(--color-primary\)/);
  });

  it("applies the default and prefersdark themes to :root", async () => {
    const dir = makeThemes({
      "light.css": "{ name: light; default: true; --color-primary: red; }",
      "dark.css": "{ name: dark; prefersdark: true; --color-primary: blue; }"
    });
    const css = await generateWithThemes(dir, ["tw-semantic-colors"], "bg-primary");
    expect(css).toContain(":where(:root)");
    expect(css).toContain("prefers-color-scheme: dark");
  });

  it("loads bare-declaration themes, taking the name from the file name", async () => {
    const dir = makeThemes({ "braze-light.css": "--color-primary: #25358d;" });
    const css = await generateWithThemes(dir, ["tw-semantic-colors"], "bg-primary");
    expect(css).toContain('[data-theme="braze-light"]');
    expect(css).toContain("--color-primary: #25358d");
  });

  it("emits no themes for a missing folder", async () => {
    const css = await generateWithThemes(
      "/nonexistent/themes",
      ["tw-semantic-colors"],
      "bg-primary-500"
    );
    expect(css).toContain(".bg-primary-500");
    expect(css).not.toContain("data-theme");
  });

  it("works next to DaisyUI, and the theme defines the variables its classes use", async () => {
    const dir = makeThemes({
      "t.css": "{ name: t; --color-primary: #1472a4; --color-base-100: #fff; }"
    });
    const css = await generateWithThemes(
      dir,
      ["daisyui", "tw-semantic-colors"],
      "bg-primary-500",
      "btn"
    );
    expect(css).toContain(".btn");
    expect(css).toContain('[data-theme="t"]');
    expect(css).toContain("--color-primary: #1472a4");
  });
});

describe("theme declared in CSS", () => {
  async function generateWithCss(css: string, ...candidates: Array<string>) {
    const compiler = await compile(`${css} @tailwind utilities;`, {
      loadModule: async (id) => ({ module: modules[id], base: process.cwd(), path: "" })
    });
    return compiler.build(candidates);
  }

  it("emits a theme from the @plugin block, without DaisyUI", async () => {
    const css = await generateWithCss(
      `@plugin "tw-semantic-colors/theme" {
        name: "inline";
        color-scheme: dark;
        --color-primary: oklch(45% 0.24 277);
        --radius-box: 1.5rem;
      }`,
      "bg-primary"
    );
    expect(css).toContain('[data-theme="inline"]');
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain("--color-primary: oklch(45% 0.24 277)");
    expect(css).toContain("--radius-box: 1.5rem");
  });

  it("applies default and prefersdark the way DaisyUI does", async () => {
    const css = await generateWithCss(
      `@plugin "tw-semantic-colors/theme" { name: "light"; default: true; --color-primary: red; }
       @plugin "tw-semantic-colors/theme" { name: "dark"; prefersdark: true; --color-primary: blue; }`,
      "bg-primary"
    );
    expect(css).toContain(":where(:root)");
    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).toContain(":root:not([data-theme])");
  });

  it("emits the same rules as DaisyUI's own theme plugin", async () => {
    const block = `{
      name: "my theme";
      default: true;
      prefersdark: true;
      color-scheme: dark;
      --color-primary: oklch(45% 0.24 277);
    }`;
    const rulesOf = (css: string) => css.slice(css.indexOf("@media")).replace(/\s+/g, " ");
    const ours = await generateWithCss(`@plugin "tw-semantic-colors/theme" ${block}`);
    const daisy = await generateWithCss(`@plugin "daisyui/theme" ${block}`);
    expect(rulesOf(ours)).toBe(rulesOf(daisy));
    expect(ours).toContain("[data-theme=");
  });

  it("works next to the main plugin and DaisyUI", async () => {
    const css = await generateWithCss(
      `@plugin "daisyui"; @plugin "tw-semantic-colors";
       @plugin "tw-semantic-colors/theme" { name: "inline"; --color-primary: #1472a4; }`,
      "bg-primary-500",
      "btn"
    );
    expect(css).toContain('[data-theme="inline"]');
    expect(css).toContain(".bg-primary-500");
    expect(css).toContain(".btn");
  });
});
