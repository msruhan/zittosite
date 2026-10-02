import sanitizeHtml from "sanitize-html";

/** Rich (HTML) service descriptions; images are referenced by URL, never inlined. */
export const RICH_DESCRIPTION_MAX = 100_000;

const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*[\d.\s,%]+\)$/i, /^var\(--tt-color-[\w-]+\)$/i];
const LENGTH = [/^\d{1,3}(\.\d{1,2})?(px|em|rem|%)$/];
const ALIGNED_BLOCKS = ["p", "h1", "h2", "h3", "h4", "li", "blockquote"];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "mark",
    "span",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "hr",
    "img",
    "sub",
    "sup",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    span: ["style"],
    mark: ["style", "data-color"],
    ol: ["start"],
    ...Object.fromEntries(ALIGNED_BLOCKS.map((tag) => [tag, ["style"]])),
  },
  allowedStyles: {
    "*": {
      color: COLOR,
      "background-color": COLOR,
      "font-size": LENGTH,
      "font-family": [/^[\w\s,'"-]{1,80}$/],
      "text-align": [/^(left|right|center|justify)$/],
      "line-height": [/^\d(\.\d{1,2})?$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer nofollow",
    }),
  },
};

/** True when the text carries markup (rich editor output or supplier HTML). */
export function isRichText(text: string): boolean {
  return /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(text);
}

/** Plain descriptions pass through; HTML is reduced to the editor's safe subset. */
export function sanitizeDescription(text: string): string {
  const trimmed = text.trim();
  if (!isRichText(trimmed)) return trimmed;
  return sanitizeHtml(trimmed, OPTIONS).trim();
}

/** Text-only view of a description (Telegram, search, previews). */
export function descriptionToPlain(text: string): string {
  if (!isRichText(text)) return text.trim();
  return sanitizeHtml(text.replace(/<\/(p|h[1-4]|li|blockquote)>|<br\s*\/?>/gi, "$&\n"), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
