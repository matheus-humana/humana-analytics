"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconInfo } from "@/components/workspace/icons";

type Props = {
  /** Full citation or explanation. This is the button's accessible name. */
  text: string;
};

/**
 * Info icon that keeps source, period, and other citations available.
 * The accessible name is the full text, so it is not only a hover decoration.
 * Click pins the tooltip open for pointer users who need to read it.
 */
export function InfoTip({ text }: Props) {
  const tipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = pinned || hover;

  useEffect(() => {
    if (!open) return;
    function place() {
      const node = buttonRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const width = 256;
      const left = Math.min(
        Math.max(8, rect.right - width),
        window.innerWidth - width - 8
      );
      setPos({ top: rect.bottom + 6, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!pinned) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPinned(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={text}
        aria-expanded={open}
        aria-controls={tipId}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => {
          setHover(false);
          setPinned(false);
        }}
        onClick={() => setPinned((value) => !value)}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <IconInfo />
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              style={{ top: pos.top, left: pos.left }}
              className="fixed z-[80] w-64 rounded-lg border border-border bg-popover px-2.5 py-2 text-left text-xs leading-snug text-popover-foreground shadow-sm"
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </>
  );
}
