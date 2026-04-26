import { useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { usePraxisStore } from "@/store/usePraxisStore";

const PHASE_COLORS = [
  "var(--accent-primary)",
  "color-mix(in oklab, var(--accent-primary) 75%, white)",
  "color-mix(in oklab, var(--accent-primary) 55%, white)",
  "color-mix(in oklab, var(--accent-primary) 35%, white)",
  "color-mix(in oklab, var(--accent-primary) 20%, white)",
];

export function TimelineTab() {
  const plan = usePraxisStore((s) => s.plan)!;
  const phases = plan.timeline;

  const totalWeeks = useMemo(
    () =>
      phases.length === 0
        ? 1
        : Math.max(...phases.map((p) => p.start_week + p.weeks - 1)),
    [phases],
  );

  if (phases.length === 0) {
    return (
      <p className="text-[14px] text-[var(--text-secondary)]">
        No timeline phases were returned for this plan.
      </p>
    );
  }

  const weekTicks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <div>
      <section>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-4">
          {totalWeeks} week schedule
        </div>

        {/* Week ruler */}
        <div className="grid items-center" style={{ gridTemplateColumns: "120px 1fr" }}>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">Week</div>
          <div className="relative h-5">
            <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--border-subtle)]" />
            <div
              className="grid h-full"
              style={{ gridTemplateColumns: `repeat(${totalWeeks}, 1fr)` }}
            >
              {weekTicks.map((w) => (
                <div
                  key={w}
                  className="relative text-[10px] text-[var(--text-muted)] tabular-nums text-center"
                >
                  <span className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1">{w}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bars */}
        <ol className="mt-4 space-y-3">
          {phases.map((p, i) => {
            const left = ((p.start_week - 1) / totalWeeks) * 100;
            const width = (p.weeks / totalWeeks) * 100;
            const color = PHASE_COLORS[i % PHASE_COLORS.length];
            const labelInside = width > 22;

            return (
              <li
                key={i}
                className="grid items-center"
                style={{ gridTemplateColumns: "120px 1fr" }}
              >
                <div className="pr-3 text-[12px] font-medium text-[var(--text-primary)] truncate">
                  {p.phase}
                </div>
                <div className="relative h-7 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                  <div
                    className={cn(
                      "absolute inset-y-0 flex items-center px-3 rounded-full",
                      "transition-[width,left] duration-700 ease-out",
                    )}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: color,
                    }}
                  >
                    {labelInside && (
                      <span className="text-[10px] font-medium text-white truncate">
                        W{p.start_week}–W{p.start_week + p.weeks - 1}
                      </span>
                    )}
                  </div>
                  {!labelInside && (
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]"
                      style={{ left: `calc(${left + width}% + 8px)` }}
                    >
                      W{p.start_week}–W{p.start_week + p.weeks - 1}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-12">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3">
          Phase details
        </div>
        <Accordion type="multiple" className="w-full">
          {phases.map((p, i) => (
            <AccordionItem key={i} value={`p-${i}`} className="border-b border-[var(--border-subtle)]">
              <AccordionTrigger className="hover:no-underline text-[13px] py-3 [&>svg]:text-[var(--text-muted)]">
                <span className="flex items-baseline gap-3">
                  <span className="text-[var(--text-primary)] font-medium">{p.phase}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {p.weeks} {p.weeks === 1 ? "week" : "weeks"}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-[13px] text-[var(--text-secondary)] pb-4">
                {p.activities && p.activities.length > 0 ? (
                  <ul className="list-disc ml-4 space-y-1">
                    {p.activities.map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Activities will be expanded as the experiment plan matures.</p>
                )}
                {p.dependencies && p.dependencies.length > 0 && (
                  <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                    Depends on: {p.dependencies.join(", ")}
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
