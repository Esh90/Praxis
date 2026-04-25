import type { PraxisPlan, NoveltyStatus } from "@/lib/praxis-types";
import { ShieldAlert, ShieldCheck, AlertTriangle, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const CONFIG: Record<NoveltyStatus, { icon: typeof ShieldCheck; color: string; bg: string; label: string }> = {
  "Not Found": { icon: ShieldCheck, color: "text-success", bg: "bg-success/10 border-success/30", label: "Novel — no prior art found" },
  "Similar Exists": { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10 border-warning/30", label: "Similar work exists" },
  "Exact Match": { icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", label: "Exact match found — review duplication risk" },
};

export function NoveltyBadge({ novelty }: { novelty: PraxisPlan["novelty"] }) {
  const cfg = CONFIG[novelty.status];
  const Icon = cfg.icon;
  return (
    <div className={cn("rounded-xl border p-5", cfg.bg)}>
      <div className="flex items-start gap-4">
        <div className={cn("size-10 rounded-lg grid place-items-center bg-background/50", cfg.color)}>
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Novelty Signal</span>
            <span className={cn("text-xs font-mono font-semibold", cfg.color)}>{novelty.status.toUpperCase()}</span>
          </div>
          <h3 className="font-semibold">{cfg.label}</h3>
          {novelty.references.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {novelty.references.slice(0, 3).map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <BookOpen className="size-3.5 mt-1 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.authors} · {r.year} · <span className="text-primary">{r.doi}</span></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
