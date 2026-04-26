import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePraxisStore } from "@/store/usePraxisStore";

export function ProtocolTab() {
  const plan = usePraxisStore((s) => s.plan)!;
  const steps = plan.protocol;

  if (steps.length === 0) {
    return (
      <p className="text-[14px] text-[var(--text-secondary)]">
        No protocol steps were returned for this plan.
      </p>
    );
  }

  return (
    <ol className="space-y-10">
      {steps.map((s, i) => (
        <li
          key={s.step}
          className={cn(
            "relative pb-10 animate-[slideUp_300ms_ease]",
            i < steps.length - 1 && "border-b border-[var(--border-subtle)]",
          )}
          style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
        >
          <div className="font-serif text-[48px] leading-none text-[var(--text-muted)] tabular-nums">
            {String(s.step).padStart(2, "0")}
          </div>

          <h3 className="mt-3 text-[16px] font-semibold leading-[1.4] text-[var(--text-primary)]">
            {s.title}
          </h3>

          <p className="mt-3 max-w-[640px] text-[14px] leading-[1.7] text-[var(--text-secondary)]">
            {s.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {s.duration_min > 0 && (
              <span className="inline-flex items-center gap-[6px] rounded-full bg-[var(--bg-tertiary)] px-[10px] py-[3px] text-[11px] text-[var(--text-secondary)]">
                <Clock className="h-[11px] w-[11px]" />
                {formatDuration(s.duration_min)}
              </span>
            )}
          </div>

          {s.critical_note && (
            <div className="mt-4 flex items-start gap-3 rounded-md border-l-[3px] border-[var(--warning)] bg-[var(--warning-subtle)] px-4 py-3">
              <AlertTriangle className="h-[14px] w-[14px] shrink-0 text-[var(--warning)] mt-[2px]" />
              <p className="text-[12px] leading-[1.55] text-[var(--text-primary)]">
                {s.critical_note}
              </p>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  if (min < 60 * 24) {
    const hours = min / 60;
    return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} h`;
  }
  const days = min / (60 * 24);
  return `${days % 1 === 0 ? days.toFixed(0) : days.toFixed(1)} d`;
}
