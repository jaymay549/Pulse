import React from "react";
import { Lightbulb, Sparkles, AlertTriangle, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickTipsSectionProps {
  onAISubmit?: (query: string) => void;
  className?: string;
}

const TIPS = [
  {
    icon: Sparkles,
    title: "Compare Vendors with AI",
    description: "Try asking: \"Compare CDK vs Reynolds\" in the search bar to get an instant AI breakdown.",
    color: "text-primary bg-primary/10",
  },
  {
    icon: AlertTriangle,
    title: "Spot Red Flags Early",
    description: "Upgrade to Pro to filter by warnings and see what dealers are cautioning others about.",
    color: "text-red-600 bg-red-50",
  },
  {
    icon: Layers,
    title: "Browse by Category",
    description: "Explore DMS, CRM, F&I, and 14 more categories to find the right vendors for your dealership.",
    color: "text-yellow-700 bg-yellow-50",
  },
];

export function QuickTipsSection({ className }: QuickTipsSectionProps) {
  return (
    <div className={cn("", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-4 w-4 text-yellow-600" />
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
          Tips to Get Started
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TIPS.map((tip) => (
          <div
            key={tip.title}
            className="p-4 bg-white rounded-xl border border-border/50"
          >
            <div className={cn("inline-flex items-center justify-center h-8 w-8 rounded-lg mb-2.5", tip.color)}>
              <tip.icon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              {tip.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {tip.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
