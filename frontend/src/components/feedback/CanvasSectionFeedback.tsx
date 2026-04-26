import { useState } from "react";
import { Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePraxisStore, type CanvasTab } from "@/store/usePraxisStore";
import { CorrectionPanel } from "@/components/feedback/CorrectionPanel";

interface Props {
  section: CanvasTab;
}

export function CanvasSectionFeedback({ section }: Props) {
  const submit = usePraxisStore((s) => s.submitFeedback);
  const plan = usePraxisStore((s) => s.plan);
  const [reaction, setReaction] = useState<"up" | "down" | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  const originalContent = plan ? sectionSnapshot(plan, section) : "";

  async function up() {
    setReaction("up");
    try {
      await submit({
        section,
        rating: 5,
        reason: "Section approved (thumbs up)",
        correction: "",
        originalContent,
      });
      toast.success("Thanks for the signal!");
    } catch {
      // soft fail
    }
  }

  function down() {
    setReaction("down");
    setShowPanel(true);
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-[10px] border border-[var(--border-subtle)]",
          "bg-[var(--bg-primary)] px-4 py-2",
        )}
      >
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
          <Star className="h-[14px] w-[14px]" />
          <span>Rate this section</span>
        </div>
        <div className="flex items-center gap-1">
          <ReactionBtn
            label="Helpful"
            active={reaction === "up"}
            onClick={up}
            color="var(--accent-primary)"
          >
            <ThumbsUp className={cn("h-[13px] w-[13px]", reaction === "up" && "fill-[var(--accent-primary)]")} />
          </ReactionBtn>
          <ReactionBtn
            label="Not helpful"
            active={reaction === "down"}
            onClick={down}
            color="var(--error)"
          >
            <ThumbsDown className={cn("h-[13px] w-[13px]", reaction === "down" && "fill-[var(--error)]")} />
          </ReactionBtn>
        </div>
      </div>

      {showPanel && (
        <CorrectionPanel
          section={section}
          originalContent={originalContent}
          onClose={() => setShowPanel(false)}
        />
      )}
    </div>
  );
}

function ReactionBtn({
  children,
  label,
  active,
  onClick,
  color,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md transition-colors",
        active ? "" : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]",
      )}
      style={active ? { color } : undefined}
    >
      {children}
    </button>
  );
}

function sectionSnapshot(
  plan: NonNullable<ReturnType<typeof usePraxisStore.getState>["plan"]>,
  section: CanvasTab,
): string {
  switch (section) {
    case "protocol":
      return JSON.stringify(plan.protocol, null, 2);
    case "materials":
      return JSON.stringify(plan.materials, null, 2);
    case "budget":
      return JSON.stringify(plan.budget, null, 2);
    case "timeline":
      return JSON.stringify(plan.timeline, null, 2);
    case "validation":
      return JSON.stringify(plan.validation, null, 2);
    default:
      return "";
  }
}
