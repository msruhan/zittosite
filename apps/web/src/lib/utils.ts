import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Design-token type scale utilities (text-display, text-body, …) must not
 * collide with color utilities (text-white, text-ink). Without this, twMerge
 * drops text-white when text-body is also present — primary buttons went black.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "metric",
            "headline",
            "title",
            "body",
            "label",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
