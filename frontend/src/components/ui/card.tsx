import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("card", className)} {...props} />;
}
export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="card-header">
      <div>
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
export function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: ReactNode;
  description?: string;
}) {
  return (
    <Card>
      <p className="label">{label}</p>
      <p className="metric">{value}</p>
      {description && <p className="muted text-sm">{description}</p>}
    </Card>
  );
}
