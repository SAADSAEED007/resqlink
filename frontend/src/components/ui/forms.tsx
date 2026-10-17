"use client";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("control", className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn("control textarea", className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn("control", className)} {...props} />;
}
export function ValidationMessage({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <p id={id} className="validation" role="alert">
      {children}
    </p>
  );
}
type FieldProps = {
  id: string;
  required: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};
export function FormField({
  label,
  description,
  error,
  required = false,
  children,
}: {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: (props: FieldProps) => ReactNode;
}) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({
        id,
        required,
        "aria-describedby":
          [description && descriptionId, error && errorId]
            .filter(Boolean)
            .join(" ") || undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {description && (
        <p id={descriptionId} className="helper">
          {description}
        </p>
      )}
      {error && <ValidationMessage id={errorId}>{error}</ValidationMessage>}
    </div>
  );
}
