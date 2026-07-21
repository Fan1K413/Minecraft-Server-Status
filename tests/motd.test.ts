import { describe, expect, it } from "vitest";
import { decodeMotd, motdText, normalizeMotd } from "../packages/core/src/motd";

describe("Minecraft MOTD normalization", () => {
  it("preserves whitelisted nested formatting", () => {
    const parts = normalizeMotd({ text: "欢迎", color: "green", extra: [{ text: "回来", bold: true }, { text: "！", color: "gold", italic: true }] });
    expect(parts).toEqual([
      { text: "欢迎", color: "green" },
      { text: "回来", color: "green", bold: true },
      { text: "！", color: "gold", italic: true },
    ]);
  });

  it("parses legacy formatting and resets", () => {
    const parts = normalizeMotd("§a绿色 §l粗体§r 默认");
    expect(parts).toEqual([{ text: "绿色 ", color: "green" }, { text: "粗体", color: "green", bold: true }, { text: " 默认" }]);
  });

  it("does not expose unsupported fields as markup", () => {
    const parts = normalizeMotd({ text: "<script>alert(1)</script>", clickEvent: { action: "open_url" }, color: "not-a-color" });
    expect(parts).toEqual([{ text: "<script>alert(1)</script>" }]);
    expect(motdText(parts)).toBe("<script>alert(1)</script>");
  });

  it("reads both new serialized parts and legacy plain text", () => {
    expect(decodeMotd('[{"text":"彩色","color":"gold"}]')).toEqual([{ text: "彩色", color: "gold" }]);
    expect(decodeMotd("旧版纯文本")).toEqual([{ text: "旧版纯文本" }]);
  });
});
