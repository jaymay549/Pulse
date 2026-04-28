interface WidenedNoticeProps {
  widenedTo: string;
}

export function WidenedNotice({ widenedTo }: WidenedNoticeProps) {
  return (
    <p className="mt-3 text-xs leading-relaxed text-slate-500">
      Compared against the broader <span className="font-semibold text-slate-700">{widenedTo}</span> category. Your specific segment doesn{`'`}t yet have enough qualifying vendors.
    </p>
  );
}
