import { Plus } from "lucide-react";
import { usePraxisStore } from "@/store/usePraxisStore";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PraxisLogo } from "@/components/layout/PraxisLogo";
import { cn } from "@/lib/utils";

export function ChatHeader() {
  const reset = usePraxisStore((s) => s.reset);
  const plan = usePraxisStore((s) => s.plan);
  const hypothesis = usePraxisStore((s) => s.hypothesis);

  const title = plan?.meta.plan_title ?? hypothesis ?? "New experiment";

  return (
    <header
      className={cn(
        "flex h-[52px] shrink-0 items-center justify-between gap-3",
        "border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <PraxisLogo size="sm" />
        <span
          className="block h-[14px] w-px bg-[var(--border-default)]"
          aria-hidden
        />
        <span
          className="truncate text-[13px] text-[var(--text-secondary)]"
          title={title}
        >
          {title || "Untitled experiment"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={reset}
          aria-label="New experiment"
          title="New experiment"
          className={cn(
            "grid h-9 w-9 place-items-center rounded-md text-[var(--text-secondary)]",
            "hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-ring",
            "transition-colors duration-150",
          )}
        >
          <Plus className="h-[18px] w-[18px]" />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
