import { isRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * Service description: rich HTML (sanitized by the API on save) or legacy plain text.
 */
export function RichDescription({ text, className }: { text: string; className?: string }) {
  if (!isRichText(text)) {
    return <p className={cn("whitespace-pre-line text-body text-ink", className)}>{text}</p>;
  }
  return <div className={cn("rich-content", className)} dangerouslySetInnerHTML={{ __html: text }} />;
}
