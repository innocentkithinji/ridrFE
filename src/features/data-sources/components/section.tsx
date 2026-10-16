import { useId, type ReactNode } from "react";

type SectionProps = {
  title: string;
  // Buttons beside the title.
  actions?: ReactNode;
  children: ReactNode;
};

// Section is one titled part of the Adapter page, a landmark named by
// its title.
export function Section({ title, actions, children }: SectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

// Field is a labelled form control with its error beside it. The error's
// ID is fieldErrorId(htmlFor), for the control's aria-describedby.
export function Field(props: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={props.htmlFor} className="text-sm font-medium">
        {props.label}
      </label>
      {props.children}
      {props.hint && <p className="text-muted-foreground text-xs">{props.hint}</p>}
      {props.error && (
        <p id={fieldErrorId(props.htmlFor)} role="alert" className="text-destructive text-xs">
          {props.error}
        </p>
      )}
    </div>
  );
}

export const fieldErrorId = (htmlFor: string) => `${htmlFor}-error`;
