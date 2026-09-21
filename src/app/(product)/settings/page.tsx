export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Settings
      </h1>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm shadow-black/5">
        <p className="text-sm text-muted sm:text-base">
          Application settings will be available here.
        </p>
      </div>
    </div>
  );
}
