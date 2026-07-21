export type MotdColor =
  | "black" | "dark_blue" | "dark_green" | "dark_aqua" | "dark_red" | "dark_purple" | "gold" | "gray"
  | "dark_gray" | "blue" | "green" | "aqua" | "red" | "light_purple" | "yellow" | "white";

export interface MotdPart {
  text: string;
  color?: MotdColor;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
}

type Style = Omit<MotdPart, "text">;
const colors: MotdColor[] = ["black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple", "gold", "gray", "dark_gray", "blue", "green", "aqua", "red", "light_purple", "yellow", "white"];
const legacy: Record<string, Partial<Style> | "reset"> = {
  "0": { color: "black" }, "1": { color: "dark_blue" }, "2": { color: "dark_green" }, "3": { color: "dark_aqua" },
  "4": { color: "dark_red" }, "5": { color: "dark_purple" }, "6": { color: "gold" }, "7": { color: "gray" },
  "8": { color: "dark_gray" }, "9": { color: "blue" }, a: { color: "green" }, b: { color: "aqua" },
  c: { color: "red" }, d: { color: "light_purple" }, e: { color: "yellow" }, f: { color: "white" },
  l: { bold: true }, o: { italic: true }, n: { underlined: true }, m: { strikethrough: true }, r: "reset",
};
const MAX_TEXT = 2_000;
const MAX_PARTS = 128;
const MAX_DEPTH = 12;

function append(parts: MotdPart[], text: string, style: Style): void {
  if (!text || parts.length >= MAX_PARTS) return;
  const remaining = MAX_TEXT - parts.reduce((sum, part) => sum + part.text.length, 0);
  if (remaining <= 0) return;
  const safeText = text.slice(0, remaining);
  const previous = parts.at(-1);
  if (previous && sameStyle(previous, style)) previous.text += safeText;
  else parts.push({ text: safeText, ...style });
}

function sameStyle(part: MotdPart, style: Style): boolean {
  return part.color === style.color && part.bold === style.bold && part.italic === style.italic && part.underlined === style.underlined && part.strikethrough === style.strikethrough;
}

function parseLegacy(text: string, initial: Style, parts: MotdPart[]): void {
  let style = { ...initial };
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "§" && index + 1 < text.length) {
      const code = legacy[text[index + 1].toLowerCase()];
      if (code) {
        append(parts, current, style); current = ""; index += 1;
        style = code === "reset" ? {} : { ...style, ...code };
        if (typeof code === "object" && "color" in code) {
          style.bold = undefined; style.italic = undefined; style.underlined = undefined; style.strikethrough = undefined;
        }
        continue;
      }
    }
    current += text[index];
  }
  append(parts, current, style);
}

function safeStyle(value: Record<string, unknown>, inherited: Style): Style {
  const color = typeof value.color === "string" && colors.includes(value.color as MotdColor) ? value.color as MotdColor : inherited.color;
  return {
    color,
    bold: typeof value.bold === "boolean" ? value.bold : inherited.bold,
    italic: typeof value.italic === "boolean" ? value.italic : inherited.italic,
    underlined: typeof value.underlined === "boolean" ? value.underlined : inherited.underlined,
    strikethrough: typeof value.strikethrough === "boolean" ? value.strikethrough : inherited.strikethrough,
  };
}

function walk(value: unknown, inherited: Style, parts: MotdPart[], depth: number): void {
  if (depth > MAX_DEPTH || parts.length >= MAX_PARTS) return;
  if (typeof value === "string") { parseLegacy(value, inherited, parts); return; }
  if (Array.isArray(value)) { value.forEach((item) => walk(item, inherited, parts, depth + 1)); return; }
  if (!value || typeof value !== "object") return;
  const component = value as Record<string, unknown>;
  const style = safeStyle(component, inherited);
  if (typeof component.text === "string") parseLegacy(component.text, style, parts);
  if (Array.isArray(component.extra)) component.extra.forEach((item) => walk(item, style, parts, depth + 1));
}

export function normalizeMotd(value: unknown): MotdPart[] {
  const parts: MotdPart[] = [];
  walk(value, {}, parts, 0);
  return parts;
}

export function motdText(parts: MotdPart[]): string { return parts.map((part) => part.text).join("").slice(0, MAX_TEXT); }

export function encodeMotd(parts: MotdPart[]): string { return JSON.stringify(parts); }

export function decodeMotd(value: string | null | undefined): MotdPart[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    const normalized = normalizeMotd(parsed);
    return normalized.length ? normalized : [{ text: value.slice(0, MAX_TEXT) }];
  } catch { return normalizeMotd(value); }
}
