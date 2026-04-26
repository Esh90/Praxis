import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePraxisStore, type CanvasTab } from "@/store/usePraxisStore";

export function RegenerateSectionButton({ section }: { section: CanvasTab }) {
  const regen = usePraxisStore((s) => s.regenerateSection);
  const status = usePraxisStore((s) => s.pipelineStatus);
  const busy = status === "regenerating";

  return (
    <button
      type="button"
      onClick={() => regen(section)}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 h-8 text-[12px]",
        "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]",
        "disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
      )}
    >
      {busy ? (
        <span className="arc-spinner arc-spinner-sm" aria-hidden />
      ) : (
        <RotateCcw className="h-[13px] w-[13px]" />
      )}
      {busy ? "Regenerating..." : "Regenerate this section"}
    </button>
  );
}
