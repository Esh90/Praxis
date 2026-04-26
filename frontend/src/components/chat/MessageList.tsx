import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { usePraxisStore, type ChatMessage } from "@/store/usePraxisStore";
import { UserMessage } from "@/components/chat/UserMessage";
import { AssistantMessage } from "@/components/chat/AssistantMessage";
import { NoveltyCard } from "@/components/chat/NoveltyCard";
import { GeneratePlanCTA } from "@/components/chat/GeneratePlanCTA";
import { LiveStatusBlock } from "@/components/status/LiveStatusBlock";
import type { NoveltyReference, NoveltyStatus } from "@/lib/praxis-types";

export function MessageList() {
  const messages = usePraxisStore((s) => s.messages);
  const status = usePraxisStore((s) => s.pipelineStatus);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, status]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-5"
    >
      {messages.map((m) => (
        <MessageRow key={m.id} message={m} />
      ))}
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  const status = usePraxisStore((s) => s.pipelineStatus);

  switch (message.type) {
    case "user":
      return <UserMessage content={message.content ?? ""} />;

    case "status": {
      const phase = (message.meta?.phase as string) ?? "qc";
      const isActive =
        (phase === "qc" && status === "qc") ||
        (phase === "generate" && status === "generating");
      const finalLabel =
        phase === "qc" ? "Literature check complete" : "Plan generated";
      return <LiveStatusBlock active={isActive} finalLabel={finalLabel} />;
    }

    case "regen_status": {
      const isActive = status === "regenerating";
      return (
        <LiveStatusBlock
          active={isActive}
          finalLabel={message.content ?? "Updates applied"}
        />
      );
    }

    case "novelty": {
      const meta = message.meta as
        | {
            status: NoveltyStatus;
            summary?: string | null;
            confidence?: string | null;
            references: NoveltyReference[];
          }
        | undefined;
      if (!meta) return null;
      return (
        <NoveltyCard
          status={meta.status}
          summary={meta.summary}
          confidence={meta.confidence}
          references={meta.references ?? []}
        />
      );
    }

    case "generate_cta":
      return <GeneratePlanCTA />;

    case "assistant":
      return (
        <AssistantMessage
          id={message.id}
          content={message.content ?? ""}
          section={message.meta?.section as string | undefined}
        />
      );

    case "system_error":
      return (
        <div
          className="flex items-start gap-3 rounded-[12px] border border-[var(--error)] bg-[var(--error-subtle)] px-4 py-3 animate-[slideUp_250ms_ease]"
          role="alert"
        >
          <AlertCircle className="h-[16px] w-[16px] shrink-0 text-[var(--error)] mt-[2px]" />
          <div>
            <p className="text-[12px] font-medium text-[var(--text-primary)]">
              Something went wrong.
            </p>
            <p className="mt-[2px] text-[12px] text-[var(--text-secondary)]">
              {message.content || "Try again or refresh the page."}
            </p>
          </div>
        </div>
      );

    default:
      return null;
  }
}
