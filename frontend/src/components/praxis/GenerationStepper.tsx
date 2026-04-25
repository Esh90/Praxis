import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Parsing Hypothesis",
  "Checking Literature QC",
  "Fetching RAG Context",
  "Generating Plan Sections",
];

export function GenerationStepper({ activeStep }: { activeStep: number }) {
  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="size-2 rounded-full bg-primary pulse-dot" />
        <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Agent Pipeline</h3>
      </div>
      <ol className="space-y-4">
        {STEPS.map((label, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <li key={label} className="flex items-start gap-3 relative">
              {i < STEPS.length - 1 && (
                <div className={cn("absolute left-[11px] top-7 bottom-[-12px] w-px", done ? "bg-success" : "bg-border")} />
              )}
              <div className="mt-0.5 shrink-0">
                {done ? (
                  <CheckCircle2 className="size-5 text-success" />
                ) : active ? (
                  <Loader2 className="size-5 text-primary animate-spin" />
                ) : (
                  <Circle className="size-5 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1">
                <div className={cn("text-sm font-medium", active && "text-primary", !done && !active && "text-muted-foreground")}>
                  {label}
                </div>
                {active && <div className="text-xs font-mono text-muted-foreground mt-0.5">Processing...</div>}
                {done && <div className="text-xs font-mono text-success/70 mt-0.5">Complete</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
