import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ReviewControls({ sectionKey }: { sectionKey: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [correction, setCorrection] = useState("");

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-border/50 space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Rate</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
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
      <div className="flex gap-2">
        <Textarea
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          placeholder="Submit correction..."
          className="text-xs min-h-[36px] py-2 bg-background/50"
          rows={1}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!correction.trim()) return;
            toast.success(`Correction logged for ${sectionKey}`);
            setCorrection("");
          }}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
