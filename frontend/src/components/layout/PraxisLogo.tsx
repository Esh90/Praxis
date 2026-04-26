import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

interface Props {
  size?: Size;
  /** Show only the monogram mark (used in tight contexts like favicons-in-headers). */
  markOnly?: boolean;
  className?: string;
}

const SIZE_CONFIG: Record<
  Size,
  { mark: number; text: string; gap: string; tracking: string; pFontSize: number; pY: number }
> = {
  sm: { mark: 22, text: "text-[18px]", gap: "gap-[8px]", tracking: "tracking-[-0.01em]", pFontSize: 20, pY: 23 },
  md: { mark: 26, text: "text-[22px]", gap: "gap-[9px]", tracking: "tracking-[-0.012em]", pFontSize: 20, pY: 23 },
  lg: { mark: 30, text: "text-[26px]", gap: "gap-[11px]", tracking: "tracking-[-0.015em]", pFontSize: 20, pY: 23 },
};

/**
 * Praxis brand logo — editorial, monochrome.
 *
 * Two halves, both in a single colour drawn from `currentColor`:
 *
 *   1. **Mark** — a filled disc with an italic serif "P" cut out of it.
 *      The cutout uses `var(--bg-primary)`, so the negative space is always
 *      the page background. In light mode the disc is near-black on beige;
 *      in dark mode it inverts to near-white on black. This is the same
 *      trick used by editorial brand seals (NYT mag, NYRB, Substack).
 *
 *   2. **Wordmark** — "Praxis" set in Instrument Serif italic (already
 *      loaded via styles.css), tight tracking, single colour. The italic
 *      and the serif do all the styling work — no gradients, no extra
 *      weight, no ornamentation. Stands out because it is *quiet* in a
 *      world of sans-serif logos.
 *
 * The whole logo inherits `currentColor`, so dropping it inside a header
 * with `text-[var(--text-primary)]` (or any other colour) just works.
 */
export function PraxisLogo({ size = "md", markOnly = false, className }: Props) {
  const cfg = SIZE_CONFIG[size];

  return (
    <span
      className={cn(
        "group inline-flex items-center select-none text-[var(--text-primary)]",
        cfg.gap,
        className,
      )}
      aria-label="Praxis"
    >
      <svg
        width={cfg.mark}
        height={cfg.mark}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 ease-out group-hover:-rotate-3"
        aria-hidden="true"
      >
        {/* Filled disc in the current text colour. */}
        <circle cx="16" cy="16" r="15" fill="currentColor" />

        {/* Italic serif "P" cut out using the page background. The font
            falls back through the same stack as `--font-serif` so the mark
            still looks correct before Instrument Serif finishes loading. */}
        <text
          x="16"
          y={cfg.pY}
          textAnchor="middle"
          style={{
            fontFamily:
              '"Instrument Serif", "Iowan Old Style", "Apple Garamond", Georgia, serif',
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: `${cfg.pFontSize}px`,
            fill: "var(--bg-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          P
        </text>
      </svg>

      {!markOnly && (
        <span
          className={cn(
            "font-serif italic font-normal leading-none",
            cfg.text,
            cfg.tracking,
            // A whisper-thin underline that grows in on hover — the only
            // bit of motion. Built with a pseudo-border via a wrapper.
            "relative",
          )}
        >
          Praxis
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -bottom-[2px] left-0 h-px w-full origin-left",
              "scale-x-0 bg-current opacity-60 transition-transform duration-300 ease-out",
              "group-hover:scale-x-100",
            )}
          />
        </span>
      )}
    </span>
  );
}
