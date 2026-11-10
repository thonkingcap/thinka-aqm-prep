import type { JSX, ReactNode } from "react";
import "./components.css";

/*
 * Small, safe Markdown renderer for chat replies.
 * Produces React elements only: every piece of source text ends up as a React
 * text child, so raw HTML in the input is shown literally, never interpreted.
 * Tolerant of streaming: unclosed fences render as code to the end, unclosed
 * inline markers render as literal characters.
 */

// ---------- inline ----------

const isWordChar = (c: string | undefined) => !!c && /[A-Za-z0-9]/.test(c);
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

function parseInline(src: string, keyBase = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let buf = "";
  let k = 0;
  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = "";
    }
  };
  const key = () => `${keyBase}-${k++}`;

  let i = 0;
  while (i < src.length) {
    const c = src[i];

    // escaped punctuation
    if (c === "\\" && i + 1 < src.length && /[\\`*_[\]()#|~>-]/.test(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    // inline code
    if (c === "`") {
      let ticks = 1;
      while (src[i + ticks] === "`") ticks++;
      const fence = "`".repeat(ticks);
      const end = src.indexOf(fence, i + ticks);
      if (end !== -1) {
        let code = src.slice(i + ticks, end);
        if (code.length > 2 && code.startsWith(" ") && code.endsWith(" ")) code = code.slice(1, -1);
        flush();
        const formula = code.trimStart().startsWith("=");
        out.push(
          <code key={key()} className={formula ? "md-code md-formula" : "md-code"}>
            {code}
          </code>,
        );
        i = end + ticks;
        continue;
      }
      buf += fence;
      i += ticks;
      continue;
    }

    // bold (** or __)
    if ((c === "*" || c === "_") && src[i + 1] === c && !isSpace(src[i + 2])) {
      const marker = c + c;
      if (c === "_" && isWordChar(src[i - 1])) {
        buf += marker;
        i += 2;
        continue;
      }
      let end = src.indexOf(marker, i + 2);
      while (end !== -1 && isSpace(src[end - 1])) end = src.indexOf(marker, end + 1);
      if (end !== -1 && end > i + 2) {
        flush();
        out.push(<strong key={key()}>{parseInline(src.slice(i + 2, end), key())}</strong>);
        i = end + 2;
        continue;
      }
      buf += marker;
      i += 2;
      continue;
    }

    // emphasis (* or _), rendered as weight 500, never italic
    if ((c === "*" || c === "_") && !isSpace(src[i + 1]) && !isWordChar(src[i - 1])) {
      let end = -1;
      for (let j = i + 1; j < src.length; j++) {
        if (src[j] === "`") {
          const close = src.indexOf("`", j + 1);
          if (close === -1) break;
          j = close;
          continue;
        }
        if (src[j] === c && src[j + 1] !== c && src[j - 1] !== c && !isSpace(src[j - 1]) && !(c === "_" && isWordChar(src[j + 1]))) {
          end = j;
          break;
        }
      }
      if (end > i + 1) {
        flush();
        out.push(
          <em key={key()} className="md-em">
            {parseInline(src.slice(i + 1, end), key())}
          </em>,
        );
        i = end + 1;
        continue;
      }
      buf += c;
      i += 1;
      continue;
    }

    // link [text](url)
    if (c === "[") {
      const m = /^\[([^\]\n]+)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/.exec(src.slice(i));
      if (m) {
        flush();
        const label = parseInline(m[1], key());
        const url = m[2];
        if (/^https?:\/\//i.test(url)) {
          out.push(
            <a key={key()} href={url} target="_blank" rel="noopener noreferrer">
              {label}
            </a>,
          );
        } else {
          out.push(<span key={key()}>{label}</span>);
        }
        i += m[0].length;
        continue;
      }
    }

    buf += c;
    i += 1;
  }
  flush();
  return out;
}

/** Lines of a paragraph joined with explicit line breaks (chat text uses single newlines). */
function inlineLines(lines: string[], keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) out.push(<br key={`${keyBase}-br${idx}`} />);
    out.push(...parseInline(line.trim(), `${keyBase}-l${idx}`));
  });
  return out;
}

// ---------- block patterns ----------

const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const LIST_ITEM = /^(\s*)([-*+•]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

const indentWidth = (s: string) => s.replace(/\t/g, "    ").length;

function isTableStart(lines: string[], i: number): boolean {
  const head = lines[i];
  const sep = lines[i + 1];
  return head !== undefined && sep !== undefined && head.includes("|") && sep.includes("-") && TABLE_SEP.test(sep) && (sep.includes("|") || head.trim().startsWith("|"));
}

function isBlockStart(lines: string[], i: number): boolean {
  const l = lines[i];
  return FENCE.test(l) || HEADING.test(l) || HR.test(l) || LIST_ITEM.test(l) || isTableStart(lines, i);
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  let inCode = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
      continue;
    }
    if (ch === "`") inCode = !inCode;
    if (ch === "|" && !inCode) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

const NUMERIC = /^[-+−]?[$€£]?\(?[-+−]?\d[\d,]*(\.\d+)?\)?%?$|^[-+−]?[$€£]?\.\d+%?$/;
function isNumericCell(raw: string): boolean {
  const s = raw.replace(/\*\*|__|`/g, "").trim();
  return s !== "" && NUMERIC.test(s);
}

type Align = "left" | "right" | "center" | undefined;

// ---------- lists ----------

type Item = { lines: string[]; children: ListNode[] };
type ListNode = { ordered: boolean; start: number; items: Item[] };

function renderList(list: ListNode, key: string): JSX.Element {
  const items = list.items.map((it, idx) => (
    <li key={`${key}-${idx}`}>
      {inlineLines(it.lines, `${key}-${idx}`)}
      {it.children.map((child, ci) => renderList(child, `${key}-${idx}-c${ci}`))}
    </li>
  ));
  return list.ordered ? (
    <ol key={key} className="md-list" start={list.start !== 1 ? list.start : undefined}>
      {items}
    </ol>
  ) : (
    <ul key={key} className="md-list">
      {items}
    </ul>
  );
}

// ---------- blocks ----------

function parseBlocks(text: string): JSX.Element[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: JSX.Element[] = [];
  let i = 0;
  let k = 0;
  const key = () => `b${k++}`;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // fenced code (unclosed fence: everything to the end is code)
    const fm = FENCE.exec(line);
    if (fm) {
      const fenceChar = fm[1][0];
      const fenceLen = fm[1].length;
      const lang = fm[2] || undefined;
      const body: string[] = [];
      i++;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (t.length >= fenceLen && t.split("").every((ch) => ch === fenceChar)) {
          i++;
          break;
        }
        body.push(lines[i]);
        i++;
      }
      out.push(
        <pre key={key()} className="md-pre">
          <code data-lang={lang}>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const hm = HEADING.exec(line);
    if (hm) {
      const level = hm[1].length;
      const content = parseInline(hm[2], `h${k}`);
      out.push(
        level <= 2 ? (
          <h3 key={key()} className="md-h">
            {content}
          </h3>
        ) : (
          <h4 key={key()} className="md-h">
            {content}
          </h4>
        ),
      );
      i++;
      continue;
    }

    if (HR.test(line)) {
      out.push(<div key={key()} className="md-gap" aria-hidden="true" />);
      i++;
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(lines[i]);
      const sepCells = splitRow(lines[i + 1]);
      const explicit: Align[] = sepCells.map((s) => {
        const l = s.startsWith(":");
        const r = s.endsWith(":");
        return l && r ? "center" : r ? "right" : l ? "left" : undefined;
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const cols = header.length;
      const numericCol = Array.from({ length: cols }, (_, c) => {
        const vals = rows.map((r) => r[c] ?? "").filter((v) => v.trim() !== "");
        return vals.length > 0 && vals.every(isNumericCell);
      });
      const kb = key();
      out.push(
        <div key={kb} className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>
                {header.map((h, c) => (
                  <th key={c} style={{ textAlign: explicit[c] ?? (numericCol[c] ? "right" : "left") }}>
                    {parseInline(h, `${kb}-h${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {Array.from({ length: cols }, (_, c) => {
                    const cell = r[c] ?? "";
                    const num = isNumericCell(cell);
                    return (
                      <td key={c} className={num ? "md-num" : undefined} style={{ textAlign: explicit[c] ?? (num ? "right" : "left") }}>
                        {parseInline(cell, `${kb}-${ri}-${c}`)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const lm = LIST_ITEM.exec(line);
    if (lm) {
      const baseIndent = indentWidth(lm[1]);
      const ordered = /\d/.test(lm[2]);
      const root: ListNode = { ordered, start: ordered ? parseInt(lm[2], 10) : 1, items: [] };
      let lastTop: Item | null = null;
      let lastChild: Item | null = null;
      let sawBlank = false;
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === "") {
          sawBlank = true;
          i++;
          continue;
        }
        const m = LIST_ITEM.exec(l);
        if (m && !HR.test(l)) {
          const ind = indentWidth(m[1]);
          const isOrd = /\d/.test(m[2]);
          if (ind >= baseIndent + 2 && lastTop) {
            // nested (one level; deeper indents flatten into this level)
            let child = lastTop.children[lastTop.children.length - 1];
            if (!child || child.ordered !== isOrd) {
              child = { ordered: isOrd, start: isOrd ? parseInt(m[2], 10) : 1, items: [] };
              lastTop.children.push(child);
            }
            lastChild = { lines: [m[3]], children: [] };
            child.items.push(lastChild);
          } else {
            if (isOrd !== root.ordered) break; // different list type: new list
            lastTop = { lines: [m[3]], children: [] };
            lastChild = null;
            root.items.push(lastTop);
          }
          sawBlank = false;
          i++;
          continue;
        }
        // continuation line: indented text after an item, without a blank gap
        const ind = indentWidth(/^\s*/.exec(l)![0]);
        if (!sawBlank && lastTop && !isBlockStart(lines, i)) {
          (lastChild ?? lastTop).lines.push(l);
          i++;
          continue;
        }
        if (sawBlank && lastTop && ind > baseIndent && !isBlockStart(lines, i)) {
          (lastChild ?? lastTop).lines.push(l);
          sawBlank = false;
          i++;
          continue;
        }
        break;
      }
      out.push(renderList(root, key()));
      continue;
    }

    // paragraph
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && (para.length === 0 || !isBlockStart(lines, i))) {
      para.push(lines[i]);
      i++;
    }
    const kp = key();
    out.push(<p key={kp}>{inlineLines(para, kp)}</p>);
  }
  return out;
}

export default function Markdown({ text }: { text: string }): JSX.Element {
  let blocks: JSX.Element[];
  try {
    blocks = parseBlocks(text ?? "");
  } catch {
    blocks = [<p key="raw">{text}</p>];
  }
  return <div className="md">{blocks}</div>;
}
