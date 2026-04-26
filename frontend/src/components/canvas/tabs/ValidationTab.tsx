import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePraxisStore } from "@/store/usePraxisStore";

export function ValidationTab() {
  const plan = usePraxisStore((s) => s.plan)!;
  const v = plan.validation;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          label="Statistical power"
          value={`${(v.statistical_power * 100).toFixed(0)}%`}
          description={v.sample_size_justification}
        />
        <MetricCard
          label="Significance"
          value={v.significance_test ? "p < 0.05" : "p < 0.05"}
          description={
            v.significance_test
              ? `${v.significance_test}, two-tailed`
              : "Two-tailed test, α = 0.05"
          }
        />
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3">
            Controls
          </div>
          <ul className="space-y-2">
            {v.controls.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-[13px] leading-[1.55] text-[var(--text-primary)]"
              >
                <span className="mt-[6px] h-[7px] w-[7px] rounded-full bg-[var(--success)] shrink-0" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3">
            Failure modes
          </div>
          <ul className="space-y-3">
            {v.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-3">
                <AlertTriangle className="mt-[2px] h-[14px] w-[14px] shrink-0 text-[var(--warning)]" />
                <div className="text-[13px] leading-[1.55]">
                  <div className="font-medium text-[var(--text-primary)]">{r.risk}</div>
                  <div className="mt-[2px] text-[var(--text-secondary)]">→ {r.mitigation}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {(v.primary_success_criterion || v.sample_size_justification) && (
        <section className="mt-12">
          <div
            className={cn(
              "rounded-[14px] border bg-[var(--success-subtle)] px-5 py-4",
              "border-[color:var(--success)]/40 flex items-start gap-3",
            )}
            style={{ borderColor: "color-mix(in oklab, var(--success) 30%, transparent)" }}
          >
            <span
              className="mt-[2px] grid h-6 w-6 place-items-center rounded-full shrink-0"
              style={{ background: "var(--success)" }}
            >
              <Check className="h-[12px] w-[12px] text-white" strokeWidth={3} />
            </span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--success)]">
                Primary success criterion
              </div>
              <p className="mt-1 text-[15px] font-medium leading-[1.5] text-[var(--text-primary)]">
                {v.primary_success_criterion || v.sample_size_justification}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[14px] bg-[var(--bg-secondary)] p-6 border border-[var(--border-subtle)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 font-serif text-[44px] leading-none text-[var(--accent-primary)] tabular-nums">
        {value}
      </div>
      <p className="mt-3 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
        {description}
      </p>
    </div>
  );
}
