import { InfoTip } from "@/components/ui/info-tip";

export function EmptyLine({
  title,
  detail,
}: {
  title: string;
  detail?: string | null;
}) {
  return (
    <p className="flex items-center gap-1 text-sm text-muted">
      <span>{title}</span>
      {detail ? <InfoTip text={detail} /> : null}
    </p>
  );
}
