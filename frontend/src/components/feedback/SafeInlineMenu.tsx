import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { safeHandler } from "@/lib/safeHandler";

/**
 * Portal-free dropdown menu used by feedback widgets.
 *
 * Why a custom menu (instead of Radix `DropdownMenu`)
 * --------------------------------------------------
 * Radix's DropdownMenu renders its content into a React Portal
 * appended to `document.body`. Portals propagate errors UP to
 * their *logical* React parent — so a throw inside a menu-item
 * handler escapes past any ErrorBoundary that lives below the
 * portal trigger's logical parent. In the previous hackathon
 * build that path was the entire app: a thrown handler inside the
 * Flag dropdown would unmount the React root and leave the user
 * staring at the bare body background.
 *
 * `SafeInlineMenu` keeps the menu inline in the DOM tree so any
 * uncaught error is naturally caught by the nearest enclosing
 * ErrorBoundary, and `safeHandler` wraps every handler so errors
 * never reach React's render cycle in the first place.
 *
 * Note: the menu items are rendered inline (not via a helper
 * component) so static a11y analyzers can verify that
 * `role="menu"` directly contains `role="menuitem"` children.
 */

export interface SafeInlineMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
}

interface Props {
  trigger: ReactNode;
  items: SafeInlineMenuItem[];
  onSelect: (id: string) => void;
  align?: "left" | "right";
  className?: string;
}

export function SafeInlineMenu({ trigger, items, onSelect, align = "left", className }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const toggle = safeHandler(() => setOpen((v) => !v));

  const handleSelect = safeHandler((id: string) => {
    setOpen(false);
    onSelect(id);
  });

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <div onClick={toggle}>{trigger}</div>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-[9999] mt-1 min-w-[180px] rounded-[10px] border p-1",
            "bg-[var(--bg-elevated)] border-[var(--border-subtle)]",
            "shadow-[var(--shadow-lg)] animate-[slideUp_120ms_ease]",
            align === "right" ? "right-0" : "left-0",
          )}
          style={{ top: "calc(100% + 4px)" }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => handleSelect(item.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-[7px] px-[10px] py-[8px]",
                "text-left text-[13px] transition-colors",
                item.danger
                  ? "text-[var(--error)] hover:bg-[var(--error-subtle)]"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]",
              )}
            >
              {item.icon && (
                <span className="shrink-0 opacity-70" aria-hidden>
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
