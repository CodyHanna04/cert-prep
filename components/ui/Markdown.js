import { Fragment } from "react";

/**
 * Minimal safe markdown: paragraphs, lists, fenced code, inline code, bold, italic and https links.
 * Output is built from React elements only (text is escaped by React); raw HTML is never interpreted.
 */

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https:\/\/[^)\s]+\))/g;

function inline(text, keyPrefix) {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer nofollow">
          {link[1]}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/** @param {string} text */
export function parseBlocks(text) {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
    } else if (line.startsWith("```")) {
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i += 1;
      blocks.push({ type: "code", text: code.join("\n") });
    } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      blocks.push({ type: ordered ? "ol" : "ul", items });
    } else {
      const para = [];
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("```") && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) para.push(lines[i++]);
      blocks.push({ type: "p", text: para.join(" ") });
    }
  }
  return blocks;
}

export function Markdown({ text, className = "" }) {
  return (
    <div className={`md ${className}`}>
      {parseBlocks(text).map((b, i) => {
        if (b.type === "code") {
          return (
            <pre key={i}>
              <code>{b.text}</code>
            </pre>
          );
        }
        if (b.type === "ul" || b.type === "ol") {
          const Tag = b.type;
          return <Tag key={i}>{b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}</Tag>;
        }
        return <p key={i}>{inline(b.text, String(i))}</p>;
      })}
    </div>
  );
}
