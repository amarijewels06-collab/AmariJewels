export function Loader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
      {label}
    </div>
  );
}
