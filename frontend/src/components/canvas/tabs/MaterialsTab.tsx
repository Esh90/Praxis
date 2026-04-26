import { useMemo } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePraxisStore } from "@/store/usePraxisStore";
import type { MaterialItem } from "@/lib/praxis-types";

export function MaterialsTab() {
  const plan = usePraxisStore((s) => s.plan)!;
  const items = plan.materials;
  const currency = plan.budget?.currency || "USD";
  const total = useMemo(
    () => items.reduce((acc, m) => acc + (m.cost || 0), 0),
    [items],
  );

  const groups = useMemo(() => groupBy(items, (m) => m.category || "Other"), [items]);

  return (
    <div>
      <Disclaimer />

      <div className="mt-8 space-y-10">
        {Object.entries(groups).map(([category, mats]) => (
          <Group key={category} category={category} items={mats} currency={currency} />
        ))}
      </div>

      <TotalCard total={total} currency={currency} />
    </div>
  );
}

function Disclaimer() {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-r-[10px] border-l-[4px] border-[var(--warning)]",
        "bg-[var(--warning-subtle)] py-3 pr-4 pl-4",
      )}
    >
      <Info className="h-[16px] w-[16px] shrink-0 text-[var(--warning)] mt-[2px]" />
      <p className="text-[13px] leading-[1.55] text-[var(--text-primary)]">
        Catalog numbers are AI-estimated for planning purposes. Verify all items with
        suppliers before ordering.
      </p>
    </div>
  );
}

function Group({
  category,
  items,
  currency,
}: {
  category: string;
  items: MaterialItem[];
  currency: string;
}) {
  const sub = items.reduce((acc, m) => acc + (m.cost || 0), 0);

  return (
    <section>
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--border-subtle)] pb-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {category}
        </h3>
        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
          {items.length} {items.length === 1 ? "item" : "items"} ·{" "}
          <span className="text-[var(--text-secondary)]">{formatMoney(sub, currency)}</span>
        </span>
      </header>

      <ul className="mt-1 -mx-3">
        {items.map((m, idx) => (
          <li
            key={`${m.name}-${idx}`}
            className={cn(
              "flex items-start justify-between gap-4 rounded-md px-3 py-3",
              "hover:bg-[var(--bg-secondary)] transition-colors duration-150",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[14px] font-medium text-[var(--text-primary)]">
                  {m.name}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                  ×{m.quantity} {m.unit}
                </span>
              </div>
              <div className="mt-[2px] text-[11px] font-mono text-[var(--text-muted)] truncate">
                {m.supplier} · {m.catalog}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {m.unit_cost ? (
                <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                  {formatMoney(m.unit_cost, currency)} ea
                </div>
              ) : null}
              <div className="text-[14px] font-medium text-[var(--text-primary)] tabular-nums">
                {formatMoney(m.cost, currency)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TotalCard({ total, currency }: { total: number; currency: string }) {
  return (
    <div
      className={cn(
        "mt-12 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6",
        "shadow-[var(--shadow-sm)]",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        Estimated total
      </div>
      <div className="mt-1 font-serif text-[44px] leading-none text-[var(--accent-primary)] tabular-nums">
        {formatMoney(total, currency)}
      </div>
      <div className="mt-2 text-[12px] text-[var(--text-secondary)]">
        {currency} · academic pricing
      </div>
    </div>
  );
}

function groupBy<T>(items: T[], key: (t: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, it) => {
    const k = key(it);
    if (!acc[k]) acc[k] = [];
    acc[k].push(it);
    return acc;
  }, {});
}

function formatMoney(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: n >= 100 ? 0 : 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(0)}`;
  }
}
