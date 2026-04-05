import { type Component, For, createSignal } from "solid-js";

// ── Syntax Highlighting (lightweight, no deps) ──────────────────────

const SYNTAX_RULES: [RegExp, string][] = [
  // Comments (// and # style)
  [/(\/\/.*$|#.*$)/gm, "syn-comment"],
  // Strings (double and single quoted)
  [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, "syn-string"],
  // Numbers
  [/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, "syn-number"],
  // Keywords
  [
    /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|try|catch|throw|new|typeof|instanceof|interface|type|enum|extends|implements|public|private|protected|static|readonly|abstract|def|self|lambda|yield|match|case|fn|pub|mod|use|struct|impl|trait|mut|ref|where|package|func|go|defer|select|chan)\b/g,
    "syn-keyword",
  ],
  // Built-in types/values
  [
    /\b(true|false|null|undefined|None|nil|void|string|number|boolean|int|float|bool|any|never|unknown|Promise|Array|Map|Set|Error|console|window|document|process|require|module)\b/g,
    "syn-builtin",
  ],
  // Function calls
  [/\b([a-zA-Z_]\w*)\s*(?=\()/g, "syn-function"],
  // Types (PascalCase)
  [/\b([A-Z][a-zA-Z0-9]*)\b/g, "syn-type"],
  // Operators
  [/(=>|===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%]=?|\.\.\.)/g, "syn-operator"],
];

function highlightCode(code: string): string {
  // Tokenize to avoid double-highlighting
  const tokens: { start: number; end: number; cls: string }[] = [];
  let escaped = code;

  // First escape HTML
  escaped = escaped.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Apply rules in order, tracking positions
  for (const [re, cls] of SYNTAX_RULES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(escaped)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // Skip if overlaps with existing token
      const overlaps = tokens.some((t) => start < t.end && end > t.start);
      if (!overlaps) {
        tokens.push({ start, end, cls });
      }
    }
  }

  // Sort tokens by position (reverse to apply from end)
  tokens.sort((a, b) => b.start - a.start);
  for (const t of tokens) {
    escaped =
      escaped.slice(0, t.start) +
      `<span class="${t.cls}">` +
      escaped.slice(t.start, t.end) +
      "</span>" +
      escaped.slice(t.end);
  }

  return escaped;
}

// ── Copy Button ─────────────────────────────────────────────────────

function CopyButton(props: { text: string; class?: string }) {
  const [copied, setCopied] = createSignal(false);
  const copy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard
      .writeText(props.text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };
  return (
    <button class={`copy-btn ${props.class || ""}`} onClick={copy}>
      {copied() ? "copied" : "copy"}
    </button>
  );
}

// ── Inline Markdown ─────────────────────────────────────────────────

function renderInline(text: string) {
  // Split on inline code, bold, and URLs
  const parts: (string | { type: "code" | "bold" | "link"; text: string; href?: string })[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push({ type: "code", text: m[1] });
    else if (m[2]) parts.push({ type: "bold", text: m[2] });
    else if (m[3]) parts.push({ type: "link", text: m[3], href: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <>
      <For each={parts}>
        {(p) => {
          if (typeof p === "string") return <>{p}</>;
          if (p.type === "code")
            return (
              <code
                class="bg-panel-border/20 px-1 rounded-sm text-text-label copyable"
                onClick={() => navigator.clipboard.writeText(p.text)}
              >
                {p.text}
              </code>
            );
          if (p.type === "bold") return <strong class="text-text-label">{p.text}</strong>;
          if (p.type === "link")
            return (
              <a href={p.href} target="_blank" rel="noreferrer noopener" class="text-safe/80 hover:text-safe underline">
                {p.text}
              </a>
            );
          return null;
        }}
      </For>
    </>
  );
}

// ── Main Renderer ───────────────────────────────────────────────────

export const MarkdownBlock: Component<{ text: string; maxLength?: number }> = (props) => {
  const lines = () => props.text.slice(0, props.maxLength || 3000).split("\n");

  // Parse into blocks
  const blocks = () => {
    const result: { type: "text" | "heading" | "list" | "code"; content: string; lang?: string }[] = [];
    const ls = lines();
    let i = 0;

    while (i < ls.length) {
      const line = ls[i];
      const trimmed = line.trim();

      // Code fence
      if (trimmed.startsWith("```")) {
        const lang = trimmed.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < ls.length && !ls[i].trim().startsWith("```")) {
          codeLines.push(ls[i]);
          i++;
        }
        i++; // skip closing ```
        result.push({ type: "code", content: codeLines.join("\n"), lang: lang || undefined });
        continue;
      }

      // Heading
      if (trimmed.startsWith("#")) {
        const level = trimmed.match(/^#+/)?.[0].length || 1;
        const text = trimmed.slice(level).trim();
        result.push({ type: "heading", content: text, lang: String(level) });
        i++;
        continue;
      }

      // List item
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) {
        const text = trimmed.replace(/^[-*]\s+|^\d+\.\s+/, "");
        result.push({ type: "list", content: text });
        i++;
        continue;
      }

      // Empty line
      if (!trimmed) {
        i++;
        continue;
      }

      // Plain text
      result.push({ type: "text", content: trimmed });
      i++;
    }

    return result;
  };

  return (
    <div class="space-y-1">
      <For each={blocks()}>
        {(block) => {
          if (block.type === "code") {
            return (
              <div class="code-block-wrapper">
                <CopyButton text={block.content} />
                <pre class="terminal-block text-[10px] leading-4" innerHTML={highlightCode(block.content)} />
              </div>
            );
          }
          if (block.type === "heading") {
            const size = block.lang === "1" ? "text-[11px]" : block.lang === "2" ? "text-[10.5px]" : "text-[10px]";
            return <div class={`${size} text-text-label font-bold mt-1.5`}>{renderInline(block.content)}</div>;
          }
          if (block.type === "list") {
            return (
              <div class="text-[10px] text-text-dim leading-4 pl-2 border-l border-panel-border/30">
                {renderInline(block.content)}
              </div>
            );
          }
          return <div class="text-[10px] text-text-dim leading-4">{renderInline(block.content)}</div>;
        }}
      </For>
    </div>
  );
};
