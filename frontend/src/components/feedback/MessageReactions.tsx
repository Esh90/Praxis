import { useState } from "react";
import { Flag, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CorrectionPanel } from "@/components/feedback/CorrectionPanel";
import { usePraxisStore, type CanvasTab } from "@/store/usePraxisStore";

interface Props {
  messageId: string;
  originalContent: string;
  section?: string;
}

export function MessageReactions({ messageId, originalContent, section }: Props) {
  const [reaction, setReaction] = useState<"up" | "down" | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const submit = usePraxisStore((s) => s.submitFeedback);

  const sectionTag = (section as CanvasTab) ?? "general";

  async function thumbsUp() {
    setReaction("up");
    try {
      await submit({
        section: sectionTag,
        rating: 5,
        reason: "Positive feedback (thumbs up)",
        correction: "",
        originalContent,
        messageId,
      });
      toast.success("Thanks!");
    } catch {
      // silent: positive feedback isn't critical
    }
  }

  function thumbsDown() {
    setReaction("down");
    setShowPanel(true);
  }

  return (
    <>
      <div
        className={cn(
          "mt-2 flex items-center gap-1",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          reaction !== null && "opacity-100",
        )}
      >
        <ReactionButton
          label="Helpful"
          active={reaction === "up"}
          activeColor="var(--accent-primary)"
          onClick={thumbsUp}
        >
          <ThumbsUp
            className={cn(
              "h-[12px] w-[12px]",
              reaction === "up" && "fill-[var(--accent-primary)]",
            )}
          />
        </ReactionButton>
        <ReactionButton
          label="Not helpful"
          active={reaction === "down"}
          activeColor="var(--error)"
          onClick={thumbsDown}
        >
          <ThumbsDown
            className={cn(
              "h-[12px] w-[12px]",
              reaction === "down" && "fill-[var(--error)]",
            )}
          />
        </ReactionButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Flag"
              className={cn(
                "grid h-6 w-6 place-items-center rounded-md text-[var(--text-muted)]",
                "hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors",
              )}
            >
              <Flag className="h-[12px] w-[12px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="text-[12px]">
            <DropdownMenuItem onClick={() => toast.success("Reported")}>
              Report as harmful
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success("Reported")}>
              Report inaccuracy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success("Reported")}>
              Report hallucination
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showPanel && (
        <CorrectionPanel
          section={sectionTag}
          originalContent={originalContent}
          messageId={messageId}
          onClose={() => setShowPanel(false)}
        />
      )}
    </>
  );
}

function ReactionButton({
  children,
  label,
  active,
  activeColor,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-6 w-6 place-items-center rounded-md transition-colors",
        active
          ? "text-[var(--text-primary)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]",
      )}
      style={active ? { color: activeColor } : undefined}
    >
      {children}
    </button>
  );
}
