const ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

function unescapeHtml(text: string): string {
  return text
    .replace(/&(lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/&amp;/g, "&");
}

/**
 * Telegram-HTML message → WhatsApp markup (*bold*, _italic_, ~strike~, `code`, "> " quotes).
 * Telegram slash commands become the WhatsApp bot's MENU keyword.
 */
export function telegramHtmlToWhatsapp(html: string): string {
  const text = html
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner: string) =>
      inner
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n"),
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) =>
      label.trim() === href ? href : `${label} (${href})`,
    )
    .replace(/<\/?(b|strong)>/gi, "*")
    .replace(/<\/?(i|em)>/gi, "_")
    .replace(/<\/?(s|del|strike)>/gi, "~")
    .replace(/<\/?pre[^>]*>/gi, "```")
    .replace(/<\/?code[^>]*>/gi, "`")
    .replace(/<[^>]+>/g, "")
    .replace(/(^|\s)\/(order|start|menu)\b/g, "$1MENU");
  return unescapeHtml(text);
}
