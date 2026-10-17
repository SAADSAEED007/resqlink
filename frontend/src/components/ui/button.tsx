import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";
import { LoadingSpinner } from "./feedback";
type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
export function buttonStyles(
  variant: Variant = "primary",
  size: "sm" | "md" | "lg" = "md",
) {
  return `button button-${variant} button-${size}`;
}
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Working",
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button
      {...props}
      type={type}
      className={cn(buttonStyles(variant, size), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={loading ? loadingLabel : props["aria-label"]}
    >
      <span className={cn("button-content", loading && "invisible")}>
        {children}
      </span>
      {loading && (
        <span className="button-loader">
          <LoadingSpinner />
        </span>
      )}
    </button>
  );
}
