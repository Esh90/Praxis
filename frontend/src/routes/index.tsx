import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, GitBranch, Workflow } from "lucide-react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { CanvasContent } from "@/components/canvas/CanvasContent";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PraxisLogo } from "@/components/layout/PraxisLogo";
import { usePraxisStore } from "@/store/usePraxisStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Praxis — From hypothesis to runnable experiment" },
      {
        name: "description",
        content:
          "Describe your scientific hypothesis. Praxis runs the literature check, builds the protocol, sources the materials, and estimates the budget — in minutes.",
      },
    ],
  }),
  component: PraxisApp,
});

function PraxisApp() {
  const isActive = usePraxisStore((s) => s.isActive);
  return isActive ? <SplitView /> : <LandingView />;
}

// ──────────────────────────────────────────────────────────────────────
// LANDING
// ──────────────────────────────────────────────────────────────────────
function LandingView() {
  const submitHypothesis = usePraxisStore((s) => s.submitHypothesis);

  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* subtle radial grid background */}
      <div className="pointer-events-none absolute inset-0 bg-grid-subtle opacity-50" aria-hidden />

      {/* Top nav */}
      <header
        className={cn(
          "relative z-10 flex h-[60px] items-center justify-between px-6",
          "border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 glass-blur",
        )}
      >
        <PraxisLogo size="lg" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="mx-auto flex min-h-[calc(100vh-60px)] max-w-[840px] flex-col items-center justify-center px-6 pb-16 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Fulcrum Science × MIT Club
          </p>

          <h1
            className={cn(
              "mt-5 font-serif text-[40px] sm:text-[48px] leading-[1.05] text-[var(--text-primary)]",
              "max-w-[720px] animate-[slideUp_400ms_ease]",
            )}
          >
            From hypothesis to
            <br />
            <span className="italic">runnable experiment.</span>
          </h1>

          <p
            className={cn(
              "mt-5 max-w-[600px] text-[16px] leading-[1.6] text-[var(--text-secondary)]",
              "animate-[slideUp_500ms_ease_80ms_both]",
            )}
          >
            Describe your scientific question in plain language. Praxis runs the
            literature check, builds the full protocol, sources the materials, and
            estimates the budget — in minutes, not weeks.
          </p>

          <div className="mt-10 w-full animate-[slideUp_600ms_ease_160ms_both]">
            <ChatInput variant="landing" onSubmit={submitHypothesis} />
          </div>
        </section>

        {/* Feature strip */}
        <section className="mx-auto max-w-[1080px] px-6 pb-24">
          <div className="grid gap-4 md:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className={cn(
                  "rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5",
                  "transition-shadow duration-200 hover:shadow-[var(--shadow-md)]",
                )}
              >
                <f.icon
                  className="h-5 w-5 text-[var(--accent-primary)]"
                  strokeWidth={2}
                  aria-hidden
                />
                <h3 className="mt-3 text-[14px] font-medium text-[var(--text-primary)]">
                  {f.title}
                </h3>
                <p className="mt-1 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
                  {f.desc}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

const FEATURES = [
  {
    icon: BookOpen,
    title: "Literature QC",
    desc: "Real-time novelty signal with sourced references from PubMed and arXiv before any plan is written.",
  },
  {
    icon: Workflow,
    title: "Full Protocol",
    desc: "Stepwise bench-realistic protocol, materials with catalog numbers, budget, and timeline — all on one canvas.",
  },
  {
    icon: GitBranch,
    title: "Feedback Loop",
    desc: "Corrections you make are stored and surfaced as few-shot context the next time a section is generated.",
  },
];

// ──────────────────────────────────────────────────────────────────────
// SPLIT VIEW
// ──────────────────────────────────────────────────────────────────────
function SplitView() {
  const submitFollowUp = usePraxisStore((s) => s.submitFollowUp);
  const status = usePraxisStore((s) => s.pipelineStatus);
  const inputDisabled = status === "qc" || status === "generating" || status === "regenerating";

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)] animate-[fadeIn_250ms_ease]">
      {/* LEFT — Chat */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-[var(--border-subtle)] animate-[slideInLeft_300ms_ease]",
          "min-w-[320px] max-w-[520px] w-full md:w-[var(--panel-left-width)]",
        )}
      >
        <ChatHeader />
        <MessageList />
        <ChatInput variant="panel" onSubmit={submitFollowUp} disabled={inputDisabled} />
      </aside>

      {/* RIGHT — Canvas */}
      <section className="hidden md:flex flex-1 flex-col overflow-hidden animate-[slideInRight_300ms_ease]">
        <CanvasToolbar />
        <CanvasContent />
      </section>
    </div>
  );
}
