import { cn } from "@/lib/utils";

interface SparklineProps {
  /** 8 normalized values 0–1 representing 90-day health-score trajectory. */
  values: number[];
  /** Apply primary-blue treatment (used on the vendor's own row). */
  isSelf?: boolean;
  /** Trend direction; when "up", the last bar is highlighted emerald. */
  trend?: "up" | "down" | "flat";
}

export function Sparkline({ values, isSelf = false, trend = "flat" }: SparklineProps) {
  const safe = (values.length === 8 ? values : padTo8(values)).map(clamp01);

  return (
    <div className="flex h-[22px] items-end justify-end gap-[1.5px]">
      {safe.map((v, i) => {
        const isLast = i === safe.length - 1;
        return (
          <span
            key={i}
            style={{ height: `${Math.max(v * 100, 8)}%` }}
            className={cn(
              "w-[3px] rounded-[1.5px]",
              isSelf
                ? "bg-primary"
                : isLast && trend === "up"
                ? "bg-emerald-600"
                : "bg-slate-300",
            )}
          />
        );
      })}
    </div>
  );
}

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function padTo8(values: number[]): number[] {
  if (values.length >= 8) return values.slice(-8);
  const padded = [...Array(8 - values.length).fill(0), ...values];
  return padded;
}
