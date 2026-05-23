type BadgeTone = "green" | "amber" | "red" | "blue" | "zinc";

const toneClasses: Record<BadgeTone, string> = {
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  red: "bg-rose-50 text-rose-800 ring-rose-200",
  zinc: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

export function Badge({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  const normalized = status.toUpperCase();
  if (["ACTIVE", "IN_STOCK"].includes(normalized)) return "green";
  if (["RESERVED"].includes(normalized)) return "amber";
  if (["SOLD", "INACTIVE"].includes(normalized)) return "red";
  return "blue";
}
