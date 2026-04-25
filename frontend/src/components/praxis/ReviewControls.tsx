import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Domain } from "@/lib/praxis-types";

function domainSlug(domainUi: Domain) {
  const map: Record<string, string> = {
    Diagnostics: "diagnostics",
    "Gut Health": "gut_health",
    "Cell Biology": "cell_biology",
    Climate: "climate",
  };
  return map[String(domainUi)] || "other";
}

export function ReviewControls({
  section,
  planId,
  experimentType,
  domainUi,
  originalContent,
}: {
  section: "protocol" | "materials" | "budget" | "timeline" | "validation";
  planId?: string | null;
  experimentType?: string;
  domainUi: Domain;
  originalContent: string;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [correction, setCorrection] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const apiBase =
    import.meta.env.VITE_PRAXIS_API_URL ||
    (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3001` : "");

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-border/50 space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Rate</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Rate ${n} out of 5`}
              title={`Rate ${n} out of 5`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-0.5"
            >
              <Star
                className={cn(
                  "size-4 transition",
                  n <= (hover || rating) ? "fill-warning text-warning" : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
        </div>
      </div>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why was the AI output wrong? (optional)"
        className="text-xs min-h-[44px] py-2 bg-background/50"
        rows={2}
      />
      <div className="flex gap-2">
        <Textarea
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          placeholder="Scientist correction..."
          className="text-xs min-h-[36px] py-2 bg-background/50"
          rows={2}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={submitting || !planId}
          onClick={async () => {
            if (!planId) return toast.error("Missing plan id — generate a plan first.");
            if (!rating) return toast.error("Pick a star rating first.");
            if (!correction.trim()) return toast.error("Enter a correction.");
            if (!originalContent.trim()) return toast.error("Missing original content to correct.");

            setSubmitting(true);
            try {
              const resp = await fetch(`${apiBase}/api/praxis/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  plan_id: planId,
                  section,
                  rating,
                  original_content: originalContent,
                  correction: correction.trim(),
                  correction_reason: reason.trim(),
                  experiment_type: experimentType || "",
                  domain: domainSlug(domainUi),
                }),
              });
              const payload = await resp.json().catch(() => ({}));
              if (!resp.ok) throw new Error(payload?.error || `HTTP ${resp.status}`);
              toast.success("Feedback saved (DB + local RAG cache).");
              setCorrection("");
              setReason("");
            } catch (e) {
              toast.error((e as Error).message || "Failed to save feedback");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? "Saving..." : "Submit"}
        </Button>
      </div>
    </div>
  );
}
