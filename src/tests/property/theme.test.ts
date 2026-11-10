import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { parseTheme, parseThemes } from "@/theme";

const tokenName = fc.stringMatching(/^--[a-z][a-z0-9-]{0,15}$/);
// Values as they appear in themes: hex colors, oklch(), lengths. No `;`, `{`, `}` or `:`.
const tokenValue = fc
  .stringMatching(/^[a-z0-9#%.() ]{1,24}$/)
  .filter((value) => value.trim() === value);

describe("parseTheme properties", () => {
  it("round-trips any set of tokens", () => {
    fc.assert(
      fc.property(fc.dictionary(tokenName, tokenValue), (tokens) => {
        const body = Object.entries(tokens)
          .map(([key, value]) => `  ${key}: ${value};`)
          .join("\n");
        expect(parseTheme(`@plugin "daisyui/theme" {\n${body}\n}`, "t").tokens).toEqual(tokens);
      })
    );
  });

  it("reads the same tokens with or without the surrounding block", () => {
    fc.assert(
      fc.property(fc.dictionary(tokenName, tokenValue), (tokens) => {
        const body = Object.entries(tokens)
          .map(([key, value]) => `${key}: ${value};`)
          .join("\n");
        expect(parseTheme(body, "t")).toEqual(
          parseTheme(`@plugin "daisyui/theme" { ${body} }`, "t")
        );
      })
    );
  });

  it("keeps every theme and its tokens separate when a file holds several", () => {
    const themeArb = fc.record({
      name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,15}$/),
      tokens: fc.dictionary(tokenName, tokenValue)
    });

    fc.assert(
      fc.property(
        fc.array(themeArb, { minLength: 1, maxLength: 6 }),
        fc.boolean(),
        (themes, withPlugin) => {
          const source = themes
            .map(({ name, tokens }) => {
              const body = Object.entries(tokens)
                .map(([key, value]) => `${key}: ${value};`)
                .join(" ");
              return `${withPlugin ? '@plugin "daisyui/theme" ' : ""}{ name: "${name}"; ${body} }`;
            })
            .join("\n");

          expect(parseThemes(source, "file").map(({ name, tokens }) => ({ name, tokens }))).toEqual(
            themes
          );
        }
      )
    );
  });

  it("uses the declared name, whatever the file name", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,15}$/),
        fc.string(),
        (name, fileName) => {
          expect(parseTheme(`{ name: "${name}"; }`, fileName).name).toBe(name);
        }
      )
    );
  });
});
