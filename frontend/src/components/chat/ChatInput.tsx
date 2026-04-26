import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Lightbulb, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePraxisStore } from "@/store/usePraxisStore";

// Sample hypotheses are EXAMPLES, not domain selectors. Clicking one fills
// the textarea only because the user opted in via the "Examples" row.
// Domain is ALWAYS auto-detected from the hypothesis content.
const SAMPLE_HYPOTHESES: { id: string; domain: string; label: string; text: string }[] = [
  {
    id: "gut",
    domain: "Gut Health",
    label: "Probiotic & gut permeability",
    text:
      "Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% versus controls, measured by FITC-dextran flux and tight-junction protein expression.",
  },
  {
    id: "diag",
    domain: "Diagnostics",
    label: "Paper-based CRP biosensor",
    text:
      "A paper-based electrochemical biosensor using anti-CRP antibodies on screen-printed gold electrodes will detect CRP in whole blood at ELISA-class sensitivity within 10 minutes.",
  },
  {
    id: "cryo",
    domain: "Cell Biology",
    label: "Trehalose vs DMSO cryopreservation",
    text:
      "Substituting trehalose for DMSO as the cryoprotectant for HeLa cells will maintain post-thaw viability above 85% while eliminating DMSO-associated cytotoxicity.",
  },
  {
    id: "co2",
    domain: "Climate",
    label: "Bioelectrochemical CO2 fixation",
    text:
      "Sporomusa ovata cultivated in a bioelectrochemical reactor at -0.4 V vs Ag/AgCl will reduce CO2 to acetate at a rate exceeding 5 mmol/L/day under nitrogen-limited conditions.",
  },
];

interface Props {
  variant: "landing" | "panel";
  /**
   * Domain is no longer set by the user — it is always inferred by
   * Agent 0 from the hypothesis text. The signature still allows a
   * domain string for backward compatibility with the panel variant.
   */
  onSubmit: (text: string, domain?: string | null) => void;
  disabled?: boolean;
}

export function ChatInput({ variant, onSubmit, disabled }: Props) {
  const inputValue = usePraxisStore((s) => s.inputValue);
  const setInputValue = usePraxisStore((s) => s.setInputValue);
  // Read the auto-detected domain (set by the store after Agent 0 returns).
  const detectedDomain = usePraxisStore((s) => s.selectedDomain);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 24 * 6 + 24)}px`;
  }, [inputValue]);

  useEffect(() => {
    if (variant === "landing") {
      const t = window.setTimeout(() => ref.current?.focus(), 250);
      return () => window.clearTimeout(t);
    }
  }, [variant]);

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const text = inputValue.trim();
    if (!text || disabled) return;
    // Domain is not provided by the user — let Agent 0 classify.
    onSubmit(text, null);
  }

  const placeholder =
    variant === "landing"
      ? "Write your hypothesis in your own words. The AI will classify the domain automatically..."
      : "Ask a follow-up, request changes...";

  // For sample chips on the landing page we always show all 4 examples;
  // there's no domain filter anymore because there's no dropdown.
  const visibleSamples = useMemo(() => SAMPLE_HYPOTHESES, []);

  // What to show in the auto-detected domain badge:
  //   - hidden until the first plan completes (detectedDomain is null)
  //   - "General Science" if Agent 0 returned "Other"
  const detectedLabel = useMemo(() => {
    if (!detectedDomain) return null;
    if (detectedDomain.toLowerCase() === "other") return "General Science";
    return detectedDomain;
  }, [detectedDomain]);

  return (
    <div
      className={cn(
        variant === "landing"
          ? "w-full max-w-[720px] mx-auto"
          : "px-4 pt-3 pb-4 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)]",
      )}
    >
      {/* ─── Textarea + send ─────────────────────────────────────────── */}
      <div
        className={cn(
          "relative flex items-end rounded-[14px] bg-[var(--bg-elevated)] border transition-all duration-150",
          focused
            ? "border-[var(--accent-primary)] shadow-[0_0_0_3px_var(--accent-subtle)]"
            : "border-[var(--border-default)] shadow-[var(--shadow-sm)]",
        )}
      >
        <textarea
          ref={ref}
          value={inputValue}
          rows={1}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            "flex-1 resize-none bg-transparent border-0 outline-none",
            "text-[15px] leading-[1.6] text-[var(--text-primary)]",
            "placeholder:text-[var(--text-muted)]",
            "px-4 py-[14px] pr-[60px] max-h-[180px]",
            "focus:ring-0",
          )}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!inputValue.trim() || disabled}
          aria-label="Send"
          className={cn(
            "absolute bottom-[10px] right-[10px] grid h-8 w-8 place-items-center rounded-full",
            "transition-all duration-150",
            inputValue.trim() && !disabled
              ? "bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] hover:scale-105 text-white shadow-[var(--shadow-sm)]"
              : "bg-[var(--border-default)] text-[var(--text-muted)] cursor-not-allowed",
          )}
        >
          <ArrowUp className="h-[14px] w-[14px]" strokeWidth={2.5} />
        </button>
      </div>

      {/* ─── Hint row ────────────────────────────────────────────────── */}
      <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-[var(--text-muted)]">
          Press{" "}
          <kbd className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-[5px] py-[1px] text-[10px] font-medium text-[var(--text-secondary)]">
            Enter
          </kbd>{" "}
          to send ·{" "}
          <kbd className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-[5px] py-[1px] text-[10px] font-medium text-[var(--text-secondary)]">
            Shift
          </kbd>
          +
          <kbd className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-[5px] py-[1px] text-[10px] font-medium text-[var(--text-secondary)]">
            Enter
          </kbd>{" "}
          for new line
        </p>
        {variant === "landing" && (
          <button
            type="button"
            onClick={() => setShowExamples((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
          >
            <Lightbulb className="h-[12px] w-[12px]" />
            {showExamples ? "Hide examples" : "Need inspiration?"}
          </button>
        )}
      </div>

      {/* ─── Auto-detected domain badge (read-only) ──────────────────── */}
      {variant === "landing" && detectedLabel && (
        <div className="mt-5 flex items-center justify-center gap-2">
          <span className="text-[11px] text-[var(--text-muted)]">Detected domain:</span>
          <span
            className="inline-flex items-center gap-[6px] rounded-full border border-[var(--accent-primary)] bg-[var(--accent-subtle)] px-[12px] py-[5px] text-[12px] font-medium text-[var(--accent-primary)]"
            title="Domain auto-detected from your hypothesis"
          >
            <Sparkles className="h-[11px] w-[11px]" strokeWidth={2.4} />
            {detectedLabel}
          </span>
          <span
            className="text-[10px] text-[var(--text-muted)] cursor-help"
            title="Domain is auto-detected from hypothesis"
          >
            (auto)
          </span>
        </div>
      )}

      {/* ─── Optional sample hypotheses (collapsed by default) ───────── */}
      {variant === "landing" && showExamples && (
        <div className="mt-5 rounded-[12px] border border-dashed border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 animate-[slideUp_200ms_ease]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[12px] font-medium text-[var(--text-primary)]">
                Sample hypotheses
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-[2px]">
                Click one to copy it into your prompt — you can edit it freely afterward.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowExamples(false)}
              aria-label="Close examples"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="h-[14px] w-[14px]" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {visibleSamples.map((s) => (
              <button
                key={s.id}
                type="button"
                title={s.text}
                onClick={() => {
                  setInputValue(s.text);
                  ref.current?.focus();
                  setShowExamples(false);
                }}
                className={cn(
                  "rounded-full border border-dashed border-[var(--border-default)] px-[12px] py-[5px]",
                  "text-[12px] text-[var(--text-secondary)] bg-[var(--bg-elevated)]",
                  "hover:border-[var(--accent-primary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)]",
                  "transition-colors duration-150",
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] mr-[6px] opacity-60">
                  {s.domain}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
