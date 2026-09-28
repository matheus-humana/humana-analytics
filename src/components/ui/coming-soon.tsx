import { IconLock } from "@/components/workspace/icons";

export function ComingSoon({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full min-h-0">
      <div
        inert
        aria-hidden
        className="pointer-events-none h-full min-h-0 select-none opacity-60 blur-[3px]"
      >
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground shadow-sm">
          <IconLock className="h-5 w-5" />
        </span>
        <p className="font-display text-sm font-semibold text-foreground">{title}</p>
        <p className="max-w-[16rem] text-xs leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}
