import { useState } from "react";
import { Flag, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CorrectionPanel } from "@/components/feedback/CorrectionPanel";
import { SafeInlineMenu } from "@/components/feedback/SafeInlineMenu";
import { usePraxisStore, type CanvasTab } from "@/store/usePraxisStore";
import { safeAsyncHandler, safeHandler } from "@/lib/safeHandler";

interface Props {
  messageId: string;
  originalContent: string;
  section?: string;
}

const FLAG_OPTIONS = [
  { id: "harmful", label: "Report as harmful" },
  { id: "inaccuracy", label: "Report inaccuracy" },
  { id: "hallucination", label: "Report hallucination" },
];

const REPORT_LABEL: Record<string, string> = {
  harmful: "Reported as harmful",
  inaccuracy: "Reported inaccuracy",
  hallucination: "Reported hallucination",
};

function safeToast(kind: "success" | "error", msg: string) {
  try {
    if (kind === "success") toast.success(msg);
    else toast.error(msg);
  } catch (err) {
    console.warn("[praxis] toast call failed:", err, msg);
  }
}

export function MessageReactions({ messageId, originalContent, section }: Props) {
  const [reaction, setReaction] = useState<"up" | "down" | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const submit = usePraxisStore((s) => s.submitFeedback);

  const sectionTag = (section as CanvasTab) ?? "general";

  const thumbsUp = safeAsyncHandler(async () => {
    setReaction("up");
    try {
      await submit({
        section: sectionTag,
        rating: 5,
        reason: "Positive feedback (thumbs up)",
        correction: "approved",
        originalContent,
        messageId,
      });
      safeToast("success", "Thanks!");
    } catch (err) {
      console.warn("[praxis] thumbs-up submission failed:", err);
    }
  }, "Could not record feedback");

  const thumbsDown = safeHandler(() => {
    setReaction("down");
    setShowPanel(true);
  });

  const onReportSelect = safeHandler((id: string) => {
    safeToast("success", REPORT_LABEL[id] ?? "Reported");
  });

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

        <SafeInlineMenu
          align="right"
          items={FLAG_OPTIONS}
          onSelect={onReportSelect}
          trigger={
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
          }
        />
      </div>

      {showPanel && (
        <CorrectionPanel
          section={sectionTag}
          originalContent={originalContent}
          messageId={messageId}
          onClose={safeHandler(() => setShowPanel(false))}
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
