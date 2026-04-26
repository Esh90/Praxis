import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePraxisStore, type CanvasTab } from "@/store/usePraxisStore";
import { exportPlanToPDF } from "@/lib/exportPDF";

const TABS: { id: CanvasTab; label: string }[] = [
  { id: "protocol", label: "Protocol" },
  { id: "materials", label: "Materials" },
  { id: "budget", label: "Budget" },
  { id: "timeline", label: "Timeline" },
  { id: "validation", label: "Validation" },
];

export function CanvasToolbar() {
  const activeTab = usePraxisStore((s) => s.activeTab);
  const setActiveTab = usePraxisStore((s) => s.setActiveTab);
  const populated = usePraxisStore((s) => s.populatedTabs);
  const plan = usePraxisStore((s) => s.plan);
  const [exporting, setExporting] = useState(false);

  const planTitle = plan?.meta.plan_title || plan?.meta.experiment_type || "Experiment plan";
  const domain = plan?.meta.domain ?? "";

  async function handleExport() {
    if (!plan) return;
    setExporting(true);
    try {
      await exportPlanToPDF(plan);
      toast.success("Plan exported as PDF");
    } catch (e) {
      toast.error((e as Error).message || "Could not export PDF");
    } finally {
      setExporting(false);
    }
  }

  return (
    <header
      className={cn(
        "flex h-[52px] shrink-0 items-center justify-between gap-3 px-4",
        "border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="truncate text-[14px] font-medium text-[var(--text-primary)]"
          title={planTitle}
        >
          {planTitle}
        </span>
        {domain && (
          <span
            className={cn(
              "shrink-0 rounded-full border border-[var(--accent-border)] bg-[var(--accent-subtle)]",
              "px-[10px] py-[2px] text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--accent-primary)]",
            )}
          >
            {domain}
          </span>
        )}
      </div>

      <nav className="hidden md:flex items-center gap-1" role="tablist">
        {TABS.map((t) => {
          const ready = populated.has(t.id);
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive ? "true" : "false"}
              onClick={() => ready && setActiveTab(t.id)}
              disabled={!ready}
              className={cn(
                "relative px-[10px] py-[14px] text-[13px] transition-colors duration-150",
                isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]",
                "hover:text-[var(--text-primary)]",
                !ready && "opacity-40 cursor-not-allowed hover:text-[var(--text-secondary)]",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "absolute left-[6px] right-[6px] -bottom-[1px] h-[2px] rounded-full transition-all duration-200",
                  isActive ? "bg-[var(--accent-primary)] opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleExport}
          disabled={!plan || exporting}
          className={cn(
            "flex items-center gap-[6px] rounded-md px-[10px] h-9 text-[12px]",
            "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]",
            "disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-ring",
          )}
        >
          {exporting ? (
            <span className="arc-spinner arc-spinner-sm" aria-hidden />
          ) : (
            <Download className="h-[14px] w-[14px]" />
          )}
          <span className="hidden sm:inline">Download PDF</span>
        </button>
      </div>
    </header>
  );
}
