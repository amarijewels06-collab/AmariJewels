"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

type DialogProps = {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
  className?: string;
  hideClose?: boolean;
};

export function Dialog({ children, onClose, open, title, className, hideClose }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-zinc-950/30 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
      <section 
        className={[
          "max-h-[92vh] w-full overflow-hidden rounded-t-lg bg-white shadow-2xl sm:max-w-3xl sm:rounded-lg",
          className
        ].filter(Boolean).join(" ")}
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
          {!hideClose && (
            <Button aria-label="Close dialog" onClick={onClose} size="icon" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          )}
        </header>
        <div className="max-h-[calc(92vh-65px)] overflow-y-auto p-5">{children}</div>
      </section>
    </div>
  );
}
