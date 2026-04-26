import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePraxisStore, type CanvasTab } from "@/store/usePraxisStore";
import { safeAsyncHandler, safeHandler } from "@/lib/safeHandler";

const REASONS: { id: string; label: string }[] = [
  { id: "reagent", label: "Incorrect reagent or catalog number" },
  { id: "timeline", label: "Unrealistic timeline" },
  { id: "pricing", label: "Wrong pricing estimate" },
  { id: "scientific", label: "Scientifically inaccurate step" },
  { id: "other", label: "Other (describe below)" },
];

interface Props {
  section: CanvasTab | "general";
  originalContent: string;
  messageId?: string;
  onClose: () => void;
}

/**
 * Defensive toast wrapper so a misconfigured Toaster (or a transient
 * sonner exception) can never bubble up and unmount the parent tree.
 */
function safeToastError(msg: string) {
  try {
    toast.error(msg);
  } catch (err) {
    console.warn("[praxis] toast.error failed:", err, msg);
  }
}

function safeToastSuccess(msg: string) {
  try {
    toast.success(msg);
  } catch (err) {
    console.warn("[praxis] toast.success failed:", err, msg);
  }
}

export function CorrectionPanel({
  section,
  originalContent,
  messageId,
  onClose,
}: Props) {
  const [reasonId, setReasonId] = useState<string>("scientific");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const submit = usePraxisStore((s) => s.submitFeedback);

  const handleReasonChange = safeHandler((id: string) => {
    if (REASONS.some((r) => r.id === id)) setReasonId(id);
  });

  const handleTextChange = safeHandler(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value ?? "");
    },
  );

  const handleClose = safeHandler(() => {
    if (!submitting) onClose();
  });

  const handleSubmit = safeAsyncHandler(async () => {
    if (submitLock.current || submitting) return;
    if (!text.trim()) {
      safeToastError("Describe the correction so we can learn from it.");
      return;
    }

    const reasonLabel =
      REASONS.find((r) => r.id === reasonId)?.label ?? reasonId;

    submitLock.current = true;
    setSubmitting(true);
    try {
      // The store's submitFeedback already mirrors to localStorage
      // first, so any backend failure is recoverable. We still await
      // so we can show a toast on success — but the await is wrapped
      // in a try/catch so a thrown rejection cannot escape this
      // handler and unmount React.
      await submit({
        section,
        rating: 2,
        reason: reasonLabel,
        correction: text.trim(),
        originalContent,
        messageId,
      });
      safeToastSuccess(
        "Correction saved — click 'Regenerate this section' to apply it.",
      );
      onClose();
    } catch (err) {
      const msg = (err as Error)?.message || "Could not save correction";
      safeToastError(msg);
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  }, "Could not save correction");

  return (
    <div
      className={cn(
        "mt-3 rounded-[12px] border bg-[var(--bg-secondary)] p-4",
        "border-[var(--border-subtle)] animate-[slideUp_200ms_ease]",
      )}
    >
      <p className="text-[12px] font-medium text-[var(--text-primary)]">
        What was wrong with this?
      </p>

      <div className="mt-3 space-y-[6px]">
        {REASONS.map((r) => (
          <label
            key={r.id}
            className={cn(
              "flex cursor-pointer items-center gap-[10px] text-[12px]",
              "text-[var(--text-secondary)]",
            )}
          >
            <span
              className={cn(
                "grid h-[14px] w-[14px] place-items-center rounded-full border transition-all",
                reasonId === r.id
                  ? "border-[var(--accent-primary)]"
                  : "border-[var(--border-default)]",
              )}
            >
              <span
                className={cn(
                  "h-[6px] w-[6px] rounded-full bg-[var(--accent-primary)] transition-opacity",
                  reasonId === r.id ? "opacity-100" : "opacity-0",
                )}
              />
            </span>
            <input
              type="radio"
              className="sr-only"
              name={`correction-reason-${section}`}
              value={r.id}
              checked={reasonId === r.id}
              onChange={() => handleReasonChange(r.id)}
            />
            {r.label}
          </label>
        ))}
      </div>

      <textarea
        value={text}
        onChange={handleTextChange}
        placeholder="Describe the correction (e.g. 'price is too high — target $200 total')..."
        rows={3}
        className={cn(
          "mt-3 w-full resize-none rounded-[10px] bg-[var(--bg-elevated)] border",
          "border-[var(--border-default)] focus-ring",
          "px-3 py-2 text-[12px] leading-[1.5] text-[var(--text-primary)]",
          "placeholder:text-[var(--text-muted)] outline-none",
        )}
      />

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleClose}
          disabled={submitting}
          className={cn(
            "rounded-md px-3 py-[6px] text-[12px] text-[var(--text-secondary)]",
            "hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50",
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(
            "rounded-md bg-[var(--accent-primary)] px-3 py-[6px] text-[12px] font-medium text-white",
            "hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors",
          )}
        >
          {submitting ? "Saving..." : "Submit Correction →"}
        </button>
      </div>
    </div>
  );
}
