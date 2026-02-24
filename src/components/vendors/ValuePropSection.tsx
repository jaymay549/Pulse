import React from "react";
import { MessageSquare, Sparkles, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValuePropSectionProps {
  className?: string;
}

const VALUE_PROPS = [
  {
    icon: MessageSquare,
    title: "Real Dealer Reviews",
    description: "Community-sourced insights from verified auto dealers in CDG Circles. No fake reviews, no vendor spin.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Insights",
    description: "Ask anything about vendors and get instant answers powered by real dealer conversations.",
  },
  {
    icon: BarChart3,
    title: "Track Vendor Sentiment",
    description: "See recommendations and warnings at a glance. Know what dealers really think before you buy.",
  },
];

export function ValuePropSection({ className }: ValuePropSectionProps) {
  return (
    <div className={cn("", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {VALUE_PROPS.map((prop) => (
          <div key={prop.title} className="text-center px-2">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary mb-3">
              <prop.icon className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5">
              {prop.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {prop.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
