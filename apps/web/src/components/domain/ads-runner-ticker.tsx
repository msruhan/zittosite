import Link from "next/link";
import { cn } from "@/lib/utils";
import type { RunningAd, RunningAdColor } from "@/lib/types";
import styles from "./ads-runner-ticker.module.css";

export const AD_TAG_CLASS: Record<RunningAdColor, string> = {
  yellow: "border-hold-edge bg-hold-wash text-hold-ink",
  red: "border-refused-edge bg-refused-wash text-refused-ink",
  green: "border-cleared-edge bg-cleared-wash text-cleared-ink",
  blue: "border-action bg-action-wash text-action-deep",
  white: "border-hairline bg-surface text-ink",
};

export function AdTag({ tag, color }: { tag: string; color: RunningAdColor }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm border px-1.5 font-data text-label font-semibold uppercase tracking-[0.08em]",
        AD_TAG_CLASS[color] ?? AD_TAG_CLASS.yellow,
      )}
    >
      {tag}
    </span>
  );
}

function AdText({ ad }: { ad: RunningAd }) {
  const linkClass = "underline-offset-4 hover:text-white hover:underline";
  if (!ad.linkUrl) return <span>{ad.text}</span>;
  return /^https?:\/\//.test(ad.linkUrl) ? (
    <a href={ad.linkUrl} target="_blank" rel="noreferrer" className={linkClass}>
      {ad.text}
    </a>
  ) : (
    <Link href={ad.linkUrl} className={linkClass}>
      {ad.text}
    </Link>
  );
}

/** Seamless marquee: the list is rendered three times and the track slides one copy's width. */
export function AdsRunnerTicker({ items }: { items: RunningAd[] }) {
  if (!items.length) return null;
  const loop = [0, 1, 2].flatMap((copy) =>
    items.map((ad) => ({ ad, key: `${copy}-${ad.id}`, hidden: copy > 0 })),
  );
  const seconds = Math.max(24, items.reduce((sum, ad) => sum + ad.text.length, 0) * 0.28);

  return (
    <div
      role="region"
      aria-label="Pengumuman"
      className={cn(styles.ticker, "overflow-hidden border-b border-white/10 bg-rail text-nav-ink")}
    >
      <div
        className={cn(styles.track, "flex w-max py-2")}
        style={{ animationDuration: `${seconds}s` }}
      >
        {loop.map(({ ad, key, hidden }) => (
          <span
            key={key}
            aria-hidden={hidden || undefined}
            className="mx-5 inline-flex items-center gap-2 whitespace-nowrap text-body"
          >
            {ad.tag ? <AdTag tag={ad.tag} color={ad.tagColor} /> : null}
            {hidden ? <span>{ad.text}</span> : <AdText ad={ad} />}
            <span aria-hidden="true" className="text-white/25">
              ·
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
