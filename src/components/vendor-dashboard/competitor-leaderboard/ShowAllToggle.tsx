interface ShowAllToggleProps {
  expanded: boolean;
  totalCount: number;
  onToggle: () => void;
}

export function ShowAllToggle({ expanded, totalCount, onToggle }: ShowAllToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2 w-full rounded-md border border-dashed border-slate-200 py-2 font-sans text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-expanded={expanded}
    >
      {expanded ? "Show fewer vendors" : `Show all ${totalCount} vendors`}
    </button>
  );
}
