import { ArrowRight, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePraxisStore } from "@/store/usePraxisStore";

export function GeneratePlanCTA() {
  const generate = usePraxisStore((s) => s.generatePlan);
  const status = usePraxisStore((s) => s.pipelineStatus);
  const disabled = status === "generating" || status === "complete" || status === "regenerating";

  return (
    <div
      className={cn(
        "rounded-[14px] border bg-[var(--bg-elevated)] p-4",
        "border-[var(--border-subtle)] shadow-[var(--shadow-sm)]",
        "animate-[slideUp_300ms_ease_100ms_both]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-md",
            "bg-[var(--accent-subtle)] text-[var(--accent-primary)]",
          )}
          aria-hidden
        >
          <FlaskConical className="h-[18px] w-[18px]" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">
            Literature check complete.
          </p>
          <p className="mt-[2px] text-[12px] text-[var(--text-secondary)]">
            Ready to build the full experiment plan: protocol, materials, budget, timeline, validation.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={disabled}
        className={cn(
          "mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] h-10",
          "bg-[var(--accent-primary)] text-white text-[13px] font-medium",
          "hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-md)]",
          "transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
          "focus-ring",
        )}
      >
        Generate Experiment Plan
        <ArrowRight className="h-[14px] w-[14px]" />
      </button>
    </div>
  );
}
