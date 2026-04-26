import { useEffect, useState } from "react";
import { FlaskConical, Sparkles } from "lucide-react";
import { usePraxisStore, type CanvasTab } from "@/store/usePraxisStore";
import { ProtocolTab } from "@/components/canvas/tabs/ProtocolTab";
import { MaterialsTab } from "@/components/canvas/tabs/MaterialsTab";
import { BudgetTab } from "@/components/canvas/tabs/BudgetTab";
import { TimelineTab } from "@/components/canvas/tabs/TimelineTab";
import { ValidationTab } from "@/components/canvas/tabs/ValidationTab";
import { TabSkeleton } from "@/components/canvas/TabSkeleton";
import { DiffIndicator } from "@/components/feedback/DiffIndicator";
import { CanvasSectionFeedback } from "@/components/feedback/CanvasSectionFeedback";
import { RegenerateSectionButton } from "@/components/feedback/RegenerateSectionButton";

export function CanvasContent() {
  const plan = usePraxisStore((s) => s.plan);
  const status = usePraxisStore((s) => s.pipelineStatus);
  const activeTab = usePraxisStore((s) => s.activeTab);
  const populated = usePraxisStore((s) => s.populatedTabs);
  const recentlyUpdated = usePraxisStore((s) => s.recentlyUpdatedTabs);

  // No plan yet → placeholder
  if (!plan) {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--bg-elevated)]">
        <div className="flex min-h-full items-center justify-center px-8 py-16">
          <div className="max-w-md text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-primary)]">
              <FlaskConical className="h-7 w-7" />
            </div>
            <h2 className="mt-6 font-serif text-[28px] leading-[1.15] text-[var(--text-primary)]">
              Your experiment plan will appear here.
            </h2>
            <p className="mt-3 text-[14px] leading-[1.6] text-[var(--text-secondary)]">
              Praxis is checking the literature first. Once that's done, you'll be able
              to generate the full protocol, materials list, budget, timeline, and
              validation approach — all on this canvas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Awaiting generate (QC done) → invitation
  if (status === "awaiting_generate") {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--bg-elevated)]">
        <div className="flex min-h-full items-center justify-center px-8 py-16">
          <div className="max-w-md text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--success-subtle)] text-[var(--success)]">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="mt-6 font-serif text-[28px] leading-[1.15] text-[var(--text-primary)]">
              Literature check complete.
            </h2>
            <p className="mt-3 text-[14px] leading-[1.6] text-[var(--text-secondary)]">
              Click <span className="font-medium text-[var(--text-primary)]">Generate Experiment Plan</span> in the chat to build the full protocol, materials, budget, timeline, and validation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tab = activeTab;
  const ready = populated.has(tab);

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-elevated)]">
      <div className="mx-auto max-w-[780px] px-8 py-12 sm:px-14 sm:py-12">
        <PlanHeader />

        {recentlyUpdated.has(tab) && <DiffIndicator section={tab} />}

        <div className="mt-10">{ready ? <TabRouter tab={tab} /> : <TabSkeleton tab={tab} />}</div>

        {ready && (
          <div className="mt-12 space-y-3 border-t border-[var(--border-subtle)] pt-6">
            <CanvasSectionFeedback section={tab} />
            <RegenerateSectionButton section={tab} />
          </div>
        )}
      </div>
    </div>
  );
}

function PlanHeader() {
  const plan = usePraxisStore((s) => s.plan)!;
  const novelty = plan.novelty.status;

  const noveltyMeta = noveltyChip(novelty);

  return (
    <header>
      <h1 className="font-serif text-[32px] leading-[1.15] text-[var(--text-primary)]">
        {plan.meta.plan_title || plan.meta.hypothesis}
      </h1>
      {plan.meta.executive_summary ? (
        <p className="mt-3 max-w-[640px] text-[15px] leading-[1.65] text-[var(--text-secondary)]">
          {plan.meta.executive_summary}
        </p>
      ) : (
        <p className="mt-3 max-w-[640px] text-[15px] leading-[1.65] text-[var(--text-secondary)]">
          {plan.meta.hypothesis}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-[10px] py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-primary)]">
          {plan.meta.domain}
        </span>
        <span
          className="rounded-full border px-[10px] py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{
            background: noveltyMeta.bg,
            color: noveltyMeta.color,
            borderColor: noveltyMeta.color,
          }}
        >
          {noveltyMeta.label}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">
          Generated <FormattedDateTime iso={plan.meta.generated_at} />
        </span>
      </div>
    </header>
  );
}

/**
 * `toLocaleString()` is browser-locale and timezone dependent — the
 * server's Node runtime and the user's browser will format the same
 * ISO string differently, which breaks SSR hydration. Render the raw
 * ISO string until after mount, then swap to the formatted version.
 */
function FormattedDateTime({ iso }: { iso: string }) {
  const [formatted, setFormatted] = useState<string | null>(null);
  useEffect(() => {
    try {
      setFormatted(new Date(iso).toLocaleString());
    } catch {
      setFormatted(iso);
    }
  }, [iso]);
  return <span suppressHydrationWarning>{formatted ?? iso}</span>;
}

function noveltyChip(s: "Not Found" | "Similar Exists" | "Exact Match") {
  if (s === "Not Found") return { label: "Novel", bg: "var(--success-subtle)", color: "var(--success)" };
  if (s === "Similar Exists") return { label: "Similar exists", bg: "var(--warning-subtle)", color: "var(--warning)" };
  return { label: "Exact match", bg: "var(--error-subtle)", color: "var(--error)" };
}

function TabRouter({ tab }: { tab: CanvasTab }) {
  switch (tab) {
    case "protocol":
      return <ProtocolTab />;
    case "materials":
      return <MaterialsTab />;
    case "budget":
      return <BudgetTab />;
    case "timeline":
      return <TimelineTab />;
    case "validation":
      return <ValidationTab />;
    default:
      return null;
  }
}
