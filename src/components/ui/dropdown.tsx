"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconCheck, IconChevron } from "@/components/workspace/icons";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  /** Shown on the closed trigger; the menu always shows the full label. */
  shortLabel?: string;
  icon?: React.ReactNode;
};

type Position = {
  left: number;
  width: number;
  maxWidth: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

type Props<T extends string> = {
  value: T;
  options: Array<DropdownOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  id?: string;
  size?: "sm" | "md";
  variant?: "field" | "ghost";
  className?: string;
  disabled?: boolean;
};

const MENU_MIN_WIDTH = 200;

function measure(button: HTMLButtonElement): Position {
  const rect = button.getBoundingClientRect();
  const width = Math.max(rect.width, MENU_MIN_WIDTH);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const maxWidth = Math.max(width, Math.min(420, window.innerWidth - left - 8));
  const below = window.innerHeight - rect.bottom - 12;
  const above = rect.top - 12;
  if (below < 200 && above > below) {
    return {
      left,
      width,
      maxWidth,
      bottom: window.innerHeight - rect.top + 6,
      maxHeight: Math.min(320, above),
    };
  }
  return { left, width, maxWidth, top: rect.bottom + 6, maxHeight: Math.min(320, below) };
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  id,
  size = "md",
  variant = "field",
  className = "",
  disabled = false,
}: Props<T>) {
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [active, setActive] = useState(-1);
  const open = position != null;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    function place() {
      if (buttonRef.current) setPosition(measure(buttonRef.current));
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setPosition(null);
    }
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  function openMenu() {
    if (!buttonRef.current || disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setPosition(measure(buttonRef.current));
  }

  function close(refocus: boolean) {
    setPosition(null);
    if (refocus) buttonRef.current?.focus();
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close(true);
  }

  function onListKey(event: React.KeyboardEvent<HTMLUListElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Tab") {
      close(false);
    }
  }

  const sizing = size === "sm" ? "px-2.5 py-1.5" : "px-3 py-2.5";
  const look =
    variant === "ghost"
      ? "border-transparent bg-transparent text-muted hover:text-foreground"
      : "border-border bg-surface text-foreground hover:bg-secondary/60";

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openMenu();
          }
        }}
        title={selected?.shortLabel ? selected.label : undefined}
        className={`flex min-w-0 items-center justify-between gap-2 rounded-lg border text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60 ${sizing} ${look} ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon}
          <span className="truncate">{selected?.shortLabel ?? selected?.label ?? ""}</span>
        </span>
        <IconChevron
          direction="down"
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "-rotate-90" : ""}`}
        />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={ariaLabel}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              onKeyDown={onListKey}
              style={{
                left: position.left,
                minWidth: position.width,
                width: "max-content",
                maxWidth: position.maxWidth,
                top: position.top,
                bottom: position.bottom,
                maxHeight: position.maxHeight,
              }}
              className="fixed z-[75] overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-lg shadow-black/10 outline-none"
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(index)}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground ${
                      index === active ? "bg-secondary" : ""
                    }`}
                  >
                    {option.icon}
                    <span
                      title={option.label}
                      className={`min-w-0 flex-1 truncate ${isSelected ? "font-medium" : ""}`}
                    >
                      {option.label}
                    </span>
                    {isSelected ? <IconCheck className="h-4 w-4 shrink-0 text-accent" /> : null}
                  </li>
                );
              })}
            </ul>,
            document.body
          )
        : null}
    </>
  );
}
