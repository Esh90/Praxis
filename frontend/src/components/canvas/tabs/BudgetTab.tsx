import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePraxisStore } from "@/store/usePraxisStore";

interface BarSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function BudgetTab() {
  const plan = usePraxisStore((s) => s.plan)!;
  const b = plan.budget;
  const total = b.grand_total > 0 ? b.grand_total : Math.max(1, b.labor + b.materials + b.contingency);

  const segments = useMemo<BarSegment[]>(
    () =>
      [
        { key: "materials", label: "Materials", value: b.materials, color: "var(--accent-primary)" },
        { key: "labor", label: "Labor", value: b.labor, color: "color-mix(in oklab, var(--accent-primary) 70%, white)" },
        { key: "equipment", label: "Equipment", value: b.equipment ?? 0, color: "color-mix(in oklab, var(--accent-primary) 50%, white)" },
        { key: "contingency", label: "Contingency", value: b.contingency, color: "color-mix(in oklab, var(--accent-primary) 30%, white)" },
      ].filter((s) => s.value > 0),
    [b],
  );

  return (
    <div>
      <section>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Estimated total
        </div>
        <div className="mt-1 font-serif text-[56px] leading-none text-[var(--accent-primary)] tabular-nums">
          {formatMoney(total, b.currency)}
        </div>
        <div className="mt-2 text-[12px] text-[var(--text-secondary)]">
          {b.currency} · {b.breakdown_notes}
        </div>
      </section>

      <section className="mt-10">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-4">
          Breakdown by category
        </div>

        <div className="space-y-3">
          {segments.map((s, i) => {
            const pct = (s.value / total) * 100;
            return (
              <div
                key={s.key}
                className="animate-[slideUp_300ms_ease]"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
              >
                <div className="flex items-baseline justify-between gap-3 text-[12px] mb-1">
                  <span className="text-[var(--text-primary)] font-medium">{s.label}</span>
                  <span className="text-[var(--text-muted)] tabular-nums">
                    {formatMoney(s.value, b.currency)}{" "}
                    <span className="text-[var(--text-muted)]">· {pct.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="h-8 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${pct}%`, background: s.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3">
          Line items
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr
              className={cn(
                "text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]",
              )}
            >
              <th className="pb-2 pr-4 border-b border-[var(--border-subtle)]">Category</th>
              <th className="pb-2 pr-4 border-b border-[var(--border-subtle)]">Description</th>
              <th className="pb-2 text-right border-b border-[var(--border-subtle)]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s, i) => (
              <tr key={s.key} className={cn(i % 2 === 0 && "bg-[var(--bg-secondary)]")}>
                <td className="py-2 px-4 text-[var(--text-primary)]">{s.label}</td>
                <td className="py-2 pr-4 text-[var(--text-secondary)]">
                  {descriptionFor(s.key)}
                </td>
                <td className="py-2 px-4 text-right tabular-nums text-[var(--text-primary)]">
                  {formatMoney(s.value, b.currency)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-3 px-4 font-semibold text-[var(--text-primary)] border-t-2 border-[var(--border-default)]">
                Total
              </td>
              <td className="py-3 border-t-2 border-[var(--border-default)]" />
              <td className="py-3 px-4 text-right tabular-nums font-semibold text-[var(--text-primary)] border-t-2 border-[var(--border-default)]">
                {formatMoney(total, b.currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

function descriptionFor(key: string) {
  switch (key) {
    case "materials":
      return "Reagents, consumables, antibodies, kits";
    case "labor":
      return "Researcher time at academic loaded rates";
    case "equipment":
      return "Core facility access and instrument time";
    case "contingency":
      return "Buffer for procurement variance and rework";
    default:
      return "";
  }
}

function formatMoney(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${n.toFixed(0)}`;
  }
}
