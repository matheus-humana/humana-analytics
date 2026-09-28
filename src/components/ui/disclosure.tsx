import { IconChevron } from "@/components/workspace/icons";

export function Disclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group rounded-xl border border-secondary" open={defaultOpen || undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/60 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 truncate">{title}</span>
        <IconChevron
          direction="down"
          className="h-4 w-4 shrink-0 text-muted transition-transform group-open:-rotate-90"
        />
      </summary>
      <div className="space-y-6 border-t border-secondary px-3 py-4">{children}</div>
    </details>
  );
}
