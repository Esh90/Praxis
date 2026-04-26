import { cn } from "@/lib/utils";
import type { CanvasTab } from "@/store/usePraxisStore";

export function TabSkeleton({ tab }: { tab: CanvasTab }) {
  if (tab === "budget") {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="h-6 w-1/4 shimmer-bg rounded" />
          <div className="h-12 w-1/2 shimmer-bg rounded" />
        </div>
        <div className="space-y-2">
          {[68, 50, 40, 30].map((w) => (
            <div key={w} className="h-8 shimmer-bg rounded-full" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (tab === "timeline") {
    return (
      <div className="space-y-3">
        {[80, 60, 90, 70].map((w, i) => (
          <div key={i} className="h-7 shimmer-bg rounded-full" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  return (
    <ol className="space-y-8">
      {[1, 2, 3].map((i) => (
        <li key={i} className={cn("space-y-3 animate-[fadeIn_200ms_ease]")}>
          <div className="h-12 w-10 shimmer-bg rounded" />
          <div className="h-5 w-3/4 shimmer-bg rounded" />
          <div className="space-y-2">
            <div className="h-3 w-full shimmer-bg rounded" />
            <div className="h-3 w-5/6 shimmer-bg rounded" />
            <div className="h-3 w-2/3 shimmer-bg rounded" />
          </div>
        </li>
      ))}
    </ol>
  );
}
