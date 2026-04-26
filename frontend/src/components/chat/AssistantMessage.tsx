import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Hexagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageReactions } from "@/components/feedback/MessageReactions";

interface Props {
  id: string;
  content: string;
  section?: string;
}

export function AssistantMessage({ id, content, section }: Props) {
  return (
    <div className="group flex items-start gap-3 animate-[slideUp_250ms_ease]">
      <div
        className={cn(
          "mt-[2px] grid h-[28px] w-[28px] shrink-0 place-items-center rounded-md",
          "bg-[var(--accent-subtle)] text-[var(--accent-primary)]",
        )}
        aria-hidden
      >
        <Hexagon className="h-[14px] w-[14px]" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="prose-praxis text-[13px] leading-[1.6] text-[var(--text-primary)]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        <MessageReactions
          messageId={id}
          originalContent={content}
          section={section}
        />
      </div>
    </div>
  );
}
