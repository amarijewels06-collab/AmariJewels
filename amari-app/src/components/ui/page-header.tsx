import type { ReactNode } from "react";

type PageHeaderProps = {
  actions?: ReactNode;
  eyebrow?: string;
  title: string;
};

export function PageHeader({ actions, eyebrow, title }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-zinc-200 bg-white px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
      <div>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
