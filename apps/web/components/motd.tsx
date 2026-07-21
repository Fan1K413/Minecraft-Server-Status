import type { MotdPart } from "@minecraft-status/core";

const colors: Record<string, string> = {
  black: "motd-black", dark_blue: "motd-dark-blue", dark_green: "motd-dark-green", dark_aqua: "motd-dark-aqua",
  dark_red: "motd-dark-red", dark_purple: "motd-dark-purple", gold: "motd-gold", gray: "motd-gray",
  dark_gray: "motd-dark-gray", blue: "motd-blue", green: "motd-green", aqua: "motd-aqua", red: "motd-red",
  light_purple: "motd-light-purple", yellow: "motd-yellow", white: "motd-white",
};

export function Motd({ parts }: { parts: MotdPart[] }) {
  if (!parts.length) return <p className="motd-value">服务器未提供 MOTD</p>;
  return <p className="motd-value">{parts.map((part, index) => {
    const className = [part.color ? colors[part.color] : "", part.bold ? "motd-bold" : "", part.italic ? "motd-italic" : "", part.underlined ? "motd-underlined" : "", part.strikethrough ? "motd-strikethrough" : ""].filter(Boolean).join(" ");
    return <span className={className || undefined} key={`${index}-${part.text}`}>{part.text}</span>;
  })}</p>;
}
