import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FieldWrapProps = {
  children: ReactNode;
  hint?: string;
  label: string;
};

export function FieldWrap({ children, hint, label }: FieldWrapProps) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "min-h-24 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100",
        props.className ?? "",
      ].join(" ")}
    />
  );
}
