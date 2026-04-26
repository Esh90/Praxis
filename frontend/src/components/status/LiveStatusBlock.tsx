import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePraxisStore, type CompletedStep } from "@/store/usePraxisStore";

interface Props {
  /** Whether the status pipeline is currently active */
  active: boolean;
  /** Optional final label override (e.g. "Literature check complete") */
  finalLabel?: string;
}

/**
 * Claude-style live status disclosure block:
 *  - Header: spinner / check + morphing step label + chevron
 *  - Expanded: stacked log of completed steps with timing
 *
 * Subscribes to the Zustand store for current step + completedSteps.
 */
export function LiveStatusBlock({ active, finalLabel }: Props) {
  const currentStep = usePraxisStore((s) => s.currentStep);
  const completed = usePraxisStore((s) => s.completedSteps);
  const [open, setOpen] = useState(active);
  const [shownLabel, setShownLabel] = useState(currentStep);
  const fadingRef = useRef(false);

  // Auto-collapse once finished
  useEffect(() => {
    if (!active) {
      const t = window.setTimeout(() => setOpen(false), 600);
      return () => window.clearTimeout(t);
    } else {
      setOpen(true);
    }
  }, [active]);

  // Crossfade label transitions
  useEffect(() => {
    if (currentStep === shownLabel) return;
    fadingRef.current = true;
    const t = window.setTimeout(() => {
      setShownLabel(currentStep);
      fadingRef.current = false;
    }, 150);
    return () => window.clearTimeout(t);
  }, [currentStep, shownLabel]);

  const headerLabel = !active && finalLabel ? finalLabel : shownLabel;

  return (
    <div
      className={cn(
        "rounded-[12px] border bg-[var(--bg-elevated)] overflow-hidden",
        "border-[var(--border-subtle)] shadow-[var(--shadow-sm)]",
        "animate-[slideUp_250ms_ease]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-[10px] text-left",
          "hover:bg-[var(--bg-secondary)] transition-colors duration-150",
        )}
      >
        {active ? (
          <span className="arc-spinner arc-spinner-sm shrink-0" aria-hidden />
        ) : (
          <span
            className="grid h-[14px] w-[14px] place-items-center rounded-full bg-[var(--success)] shrink-0"
            aria-hidden
          >
            <Check className="h-[10px] w-[10px] text-white" strokeWidth={3} />
          </span>
        )}

        <span
          className={cn(
            "flex-1 text-[13px] font-medium text-[var(--text-primary)]",
            "transition-opacity duration-150",
            fadingRef.current ? "opacity-0" : "opacity-100",
          )}
        >
          {headerLabel || "Working..."}
        </span>

        <ChevronDown
          className={cn(
            "h-[14px] w-[14px] text-[var(--text-muted)] transition-transform duration-200 shrink-0",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          open
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0 pointer-events-none",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-3 pt-1 border-t border-[var(--border-subtle)]">
            <ol className="space-y-[6px] mt-2">
              {completed.map((s) => (
                <StepLine key={s.id} step={s} />
              ))}
              {active && (
                <li className="flex items-center gap-2 text-[12px]">
                  <span className="arc-spinner arc-spinner-sm" aria-hidden />
                  <span className="text-[var(--text-primary)]">
                    {currentStep || "Working..."}
                  </span>
                  <span className="ml-auto text-[11px] text-[var(--text-muted)]">
                    live
                  </span>
                </li>
              )}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepLine({ step }: { step: CompletedStep }) {
  return (
    <li className="flex items-center gap-2 text-[12px] animate-[fadeIn_150ms_ease]">
      <span
        className="grid h-[12px] w-[12px] place-items-center rounded-full bg-[var(--success)] shrink-0"
        aria-hidden
      >
        <Check className="h-[8px] w-[8px] text-white" strokeWidth={3} />
      </span>
      <span className="text-[var(--text-primary)] truncate">{step.label}</span>
      <span className="ml-auto text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
        {(step.durationMs / 1000).toFixed(1)}s
      </span>
    </li>
  );
}
