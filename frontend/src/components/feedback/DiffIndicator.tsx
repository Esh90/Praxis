import { useState } from "react";
import { ChevronDown, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePraxisStore, type CanvasTab } from "@/store/usePraxisStore";

interface Props {
  section: CanvasTab;
}

export function DiffIndicator({ section }: Props) {
  const [open, setOpen] = useState(false);
  const previous = usePraxisStore((s) => s.previousPlanSnapshot);
  const plan = usePraxisStore((s) => s.plan);
  const dismiss = usePraxisStore((s) => s.dismissDiff);

  if (!plan || !previous) return null;

  const before = sectionToString(previous, section);
  const after = sectionToString(plan, section);
  const lines = simpleLineDiff(before, after);

  return (
    <div
      className={cn(
        "mt-6 rounded-[12px] border border-[var(--accent-border)] bg-[var(--accent-subtle)]",
        "animate-[slideUp_250ms_ease]",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <Sparkles
          className="h-[14px] w-[14px] text-[var(--accent-primary)] shrink-0"
          aria-hidden
        />
        <span className="text-[12px] font-medium text-[var(--accent-primary)]">
          Updated from your feedback
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex items-center gap-1 text-[11px] text-[var(--accent-primary)] hover:underline"
        >
          {open ? "Hide changes" : "See what changed"}
          <ChevronDown
            className={cn(
              "h-[12px] w-[12px] transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => dismiss(section)}
          aria-label="Dismiss"
          className="grid h-6 w-6 place-items-center rounded text-[var(--accent-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <X className="h-[12px] w-[12px]" />
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--accent-border)] bg-[var(--bg-elevated)] rounded-b-[12px] px-4 py-3 max-h-72 overflow-y-auto">
          <pre className="text-[11px] leading-[1.6] font-mono whitespace-pre-wrap break-words">
            {lines.map((l, i) => (
              <span
                key={i}
                className={cn(
                  "block px-1 -mx-1 rounded-sm",
                  l.kind === "added" && "bg-[var(--success-subtle)] text-[var(--text-primary)]",
                  l.kind === "removed" &&
                    "bg-[var(--error-subtle)] text-[var(--text-secondary)] line-through",
                  l.kind === "context" && "text-[var(--text-muted)]",
                )}
              >
                {l.kind === "added" ? "+ " : l.kind === "removed" ? "- " : "  "}
                {l.text}
              </span>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}

function sectionToString(plan: { protocol: unknown; materials: unknown; budget: unknown; timeline: unknown; validation: unknown }, section: CanvasTab): string {
  return JSON.stringify(plan[section], null, 2);
}

function simpleLineDiff(a: string, b: string): { kind: "added" | "removed" | "context"; text: string }[] {
  const A = a.split("\n");
  const B = b.split("\n");
  const setA = new Set(A);
  const setB = new Set(B);
  const out: { kind: "added" | "removed" | "context"; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length || j < B.length) {
    const la = A[i];
    const lb = B[j];
    if (i < A.length && j < B.length && la === lb) {
      out.push({ kind: "context", text: la });
      i++; j++;
    } else if (j < B.length && !setA.has(lb)) {
      out.push({ kind: "added", text: lb });
      j++;
    } else if (i < A.length && !setB.has(la)) {
      out.push({ kind: "removed", text: la });
      i++;
    } else {
      // fall back: advance both
      if (i < A.length) out.push({ kind: "context", text: la });
      i++; j++;
    }
  }
  return out.slice(0, 100);
}
