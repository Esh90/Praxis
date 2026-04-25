import type { Domain, PraxisPlan } from "@/lib/praxis-types";
import { ReviewControls } from "./ReviewControls";
import { Clock } from "lucide-react";

export function ProtocolView({
  steps,
  reviewMode,
  planId,
  experimentType,
  domainUi,
}: {
  steps: PraxisPlan["protocol"];
  reviewMode: boolean;
  planId?: string | null;
  experimentType?: string;
  domainUi: Domain;
}) {
  return (
    <ol className="space-y-4">
      {steps.map((s) => (
        <li key={s.step} className="glass rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="size-9 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center text-primary font-mono font-semibold shrink-0">
              {String(s.step).padStart(2, "0")}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3 mb-1">
                <h4 className="font-semibold">{s.title}</h4>
                <span className="text-xs font-mono text-muted-foreground flex items-center gap-1 shrink-0">
                  <Clock className="size-3" /> {s.duration_min}m
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              {reviewMode && (
                <ReviewControls
                  section="protocol"
                  planId={planId}
                  experimentType={experimentType}
                  domainUi={domainUi}
                  originalContent={`Step ${s.step}: ${s.title}\n${s.description}\nDuration: ${s.duration_min} minutes`}
                />
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function BudgetView({
  budget,
  reviewMode,
  planId,
  experimentType,
  domainUi,
}: {
  budget: PraxisPlan["budget"];
  reviewMode: boolean;
  planId?: string | null;
  experimentType?: string;
  domainUi: Domain;
}) {
  const items = [
    { label: "Labor", value: budget.labor, color: "bg-chart-1" },
    { label: "Materials", value: budget.materials, color: "bg-chart-2" },
    { label: "Contingency", value: budget.contingency, color: "bg-chart-4" },
  ];
  const total = budget.grand_total;
  const safeTotal = total > 0 ? total : 1;
  return (
    <div className="space-y-5">
      <div className="glass rounded-xl p-6">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Grand Total</div>
        <div className="mt-1 text-5xl font-bold tracking-tight gradient-text font-mono">
          ${total.toLocaleString()} <span className="text-lg text-muted-foreground">{budget.currency}</span>
        </div>
        <div className="mt-5 flex h-2 rounded-full overflow-hidden">
          {items.map((it) => (
            <div key={it.label} className={it.color} style={{ width: `${(it.value / safeTotal) * 100}%` }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5">
          {items.map((it) => (
            <div key={it.label}>
              <div className="flex items-center gap-2">
                <div className={`size-2 rounded-full ${it.color}`} />
                <span className="text-xs text-muted-foreground">{it.label}</span>
              </div>
              <div className="font-mono font-semibold mt-1">${it.value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-mono">{((it.value / safeTotal) * 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-5 italic">{budget.breakdown_notes}</p>
        {reviewMode && (
          <ReviewControls
            section="budget"
            planId={planId}
            experimentType={experimentType}
            domainUi={domainUi}
            originalContent={`Budget snapshot:\nLabor: $${budget.labor}\nMaterials: $${budget.materials}\nContingency: $${budget.contingency}\nGrand total: $${budget.grand_total} ${budget.currency}\nNotes: ${budget.breakdown_notes}`}
          />
        )}
      </div>
    </div>
  );
}

export function TimelineView({
  timeline,
  reviewMode,
  planId,
  experimentType,
  domainUi,
}: {
  timeline: PraxisPlan["timeline"];
  reviewMode: boolean;
  planId?: string | null;
  experimentType?: string;
  domainUi: Domain;
}) {
  const totalWeeks = Math.max(...timeline.map((t) => t.start_week + t.weeks - 1));
  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Project Schedule</span>
        <span className="text-xs font-mono text-primary">{totalWeeks} weeks total</span>
      </div>
      <div className="space-y-3">
        {timeline.map((t, i) => {
          const left = ((t.start_week - 1) / totalWeeks) * 100;
          const width = (t.weeks / totalWeeks) * 100;
          return (
            <div key={i} className="grid grid-cols-[180px_1fr_60px] items-center gap-3">
              <div className="text-sm font-medium truncate">{t.phase}</div>
              <div className="relative h-6 bg-surface rounded">
                <div
                  className="absolute top-0 bottom-0 rounded bg-gradient-to-r from-primary to-accent glow"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              <div className="text-xs font-mono text-muted-foreground text-right">W{t.start_week}–{t.start_week + t.weeks - 1}</div>
            </div>
          );
        })}
      </div>
      {reviewMode && (
        <ReviewControls
          section="timeline"
          planId={planId}
          experimentType={experimentType}
          domainUi={domainUi}
          originalContent={`Timeline:\n${timeline
            .map((t) => `- ${t.phase}: weeks ${t.start_week}-${t.start_week + t.weeks - 1} (${t.weeks}w)`)
            .join("\n")}`}
        />
      )}
    </div>
  );
}

export function ValidationView({
  validation,
  reviewMode,
  planId,
  experimentType,
  domainUi,
}: {
  validation: PraxisPlan["validation"];
  reviewMode: boolean;
  planId?: string | null;
  experimentType?: string;
  domainUi: Domain;
}) {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Statistical Power</div>
          <div className="mt-2 text-4xl font-bold gradient-text font-mono">{(validation.statistical_power * 100).toFixed(0)}%</div>
          <p className="text-xs text-muted-foreground mt-2">{validation.sample_size_justification}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Controls</div>
          <ul className="space-y-1.5 text-sm">
            {validation.controls.map((c) => (
              <li key={c} className="flex items-start gap-2">
                <span className="text-success mt-1">●</span> {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="glass rounded-xl p-5">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Risks & Mitigations</div>
        <div className="space-y-3">
          {validation.risks.map((r, i) => (
            <div key={i} className="border-l-2 border-warning/50 pl-4 py-1">
              <div className="font-medium text-sm">{r.risk}</div>
              <div className="text-sm text-muted-foreground mt-0.5"><span className="text-success font-mono text-xs">→</span> {r.mitigation}</div>
            </div>
          ))}
        </div>
      </div>
      {reviewMode && (
        <ReviewControls
          section="validation"
          planId={planId}
          experimentType={experimentType}
          domainUi={domainUi}
          originalContent={`Validation plan:\nPower: ${(validation.statistical_power * 100).toFixed(0)}%\nJustification: ${validation.sample_size_justification}\nControls:\n${validation.controls
            .map((c) => `- ${c}`)
            .join("\n")}`}
        />
      )}
    </div>
  );
}
