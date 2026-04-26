import { Bookmark, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoveltyReference, NoveltyStatus } from "@/lib/praxis-types";

interface Props {
  status: NoveltyStatus;
  summary?: string | null;
  confidence?: string | null;
  references: NoveltyReference[];
}

const STATUS_META: Record<
  NoveltyStatus,
  { label: string; bgVar: string; textVar: string; borderVar: string; description: string }
> = {
  "Not Found": {
    label: "Not found",
    bgVar: "var(--success-subtle)",
    textVar: "var(--success)",
    borderVar: "var(--success)",
    description: "No prior art found for this exact framing.",
  },
  "Similar Exists": {
    label: "Similar exists",
    bgVar: "var(--warning-subtle)",
    textVar: "var(--warning)",
    borderVar: "var(--warning)",
    description: "Related literature exists. Review for differentiation.",
  },
  "Exact Match": {
    label: "Exact match",
    bgVar: "var(--error-subtle)",
    textVar: "var(--error)",
    borderVar: "var(--error)",
    description: "Closely matching prior work — review duplication risk.",
  },
};

export function NoveltyCard({ status, summary, confidence, references }: Props) {
  const meta = STATUS_META[status];

  return (
    <div
      className={cn(
        "rounded-[14px] border bg-[var(--bg-elevated)] overflow-hidden",
        "border-[var(--border-subtle)] shadow-[var(--shadow-sm)]",
        "animate-[slideUp_300ms_ease]",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Novelty signal
          </div>
          <p className="mt-2 text-[13px] leading-[1.55] text-[var(--text-primary)]">
            {summary?.trim() || meta.description}
            {confidence && (
              <span className="ml-1 text-[var(--text-secondary)]">
                Confidence: <span className="font-medium text-[var(--text-primary)]">{confidence}</span>.
              </span>
            )}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full border px-3 py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{
            background: meta.bgVar,
            color: meta.textVar,
            borderColor: meta.borderVar,
          }}
        >
          {meta.label}
        </span>
      </div>

      {references.length > 0 && (
        <>
          <div className="px-5">
            <div className="border-t border-dashed border-[var(--border-subtle)]" />
          </div>
          <div className="px-5 pt-3 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Related literature
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                Click any item to open the source
              </div>
            </div>
            <ul className="-mx-2">
              {references.map((r, idx) => (
                <ReferenceRow key={`${r.url}-${idx}`} reference={r} />
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function ReferenceRow({ reference }: { reference: NoveltyReference }) {
  const href = reference.url || "#";
  const hasUrl = Boolean(reference.url);
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "group block rounded-md px-2 py-2",
          "hover:bg-[var(--bg-secondary)] transition-colors duration-150",
          !hasUrl && "pointer-events-none opacity-70",
        )}
      >
        <div className="flex items-start gap-3">
          <Bookmark className="mt-[2px] h-[14px] w-[14px] shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium leading-[1.45] text-[var(--text-primary)]">
              {reference.title}
            </div>
            <div className="mt-[3px] text-[11px] text-[var(--text-muted)]">
              {(reference.source || "Source") + " · " + reference.year}
            </div>
            {hasUrl && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--accent-primary)]">
                <span className="truncate underline-offset-2 group-hover:underline">
                  {prettyUrl(reference.url)}
                </span>
                <ExternalLink className="h-[10px] w-[10px] shrink-0" />
              </div>
            )}
          </div>
        </div>
      </a>
    </li>
  );
}

function prettyUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 32 ? `${u.pathname.slice(0, 30)}…` : u.pathname;
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}
