import { cn } from "@/lib/utils";

export function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end animate-[slideInRight_300ms_ease]">
      <div
        className={cn(
          "max-w-[85%] rounded-[14px] px-[14px] py-[10px]",
          "bg-[var(--accent-subtle)] border border-[var(--accent-border)]",
          "text-[13px] leading-[1.5] text-[var(--text-primary)]",
        )}
      >
        {content}
      </div>
    </div>
  );
}
