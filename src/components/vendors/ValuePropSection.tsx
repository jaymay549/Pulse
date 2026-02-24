import { MessageSquare, Sparkles, BarChart3, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValuePropSectionProps {
  className?: string;
}

const VALUE_PROPS: { icon: LucideIcon; title: string; description: string; gradient: string }[] = [
  {
    icon: MessageSquare,
    title: "Real Dealer Reviews",
    description: "Community-sourced insights from verified auto dealers in CDG Circles. No fake reviews, no vendor spin.",
    gradient: "from-blue-500/90 to-blue-600/90",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Insights",
    description: "Ask anything about vendors and get instant answers powered by real dealer conversations.",
    gradient: "from-yellow-500/90 to-orange-500/90",
  },
  {
    icon: BarChart3,
    title: "Track Vendor Sentiment",
    description: "See recommendations and warnings at a glance. Know what dealers really think before you buy.",
    gradient: "from-emerald-500/90 to-teal-600/90",
  },
];

export function ValuePropSection({ className }: ValuePropSectionProps) {
  return (
    <section className={cn("w-full", className)}>
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          Why Dealers Trust CDG Pulse
        </h2>
        <p className="text-sm text-muted-foreground mt-3">
          Everything you need to research, compare, and choose the right vendors for your dealership.
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-8">
        {VALUE_PROPS.map((prop) => (
          <div
            key={prop.title}
            className="max-w-80 hover:-translate-y-0.5 transition duration-300"
          >
            {/* Illustration block */}
            <div className={cn(
              "rounded-xl h-44 flex items-center justify-center bg-gradient-to-br",
              prop.gradient
            )}>
              <prop.icon className="h-14 w-14 text-white/90" strokeWidth={1.5} />
            </div>

            <h3 className="text-base font-semibold text-foreground mt-5">
              {prop.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {prop.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
