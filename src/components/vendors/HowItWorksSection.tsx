import React from "react";
import { Search, BookOpen, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HowItWorksSectionProps {
  className?: string;
}

const STEPS = [
  {
    icon: Search,
    step: "1",
    title: "Search or Browse",
    description: "Find vendors by name or explore categories like DMS, CRM, F&I, and more.",
  },
  {
    icon: BookOpen,
    step: "2",
    title: "Read Real Reviews",
    description: "See what verified dealers are actually saying — the good and the bad.",
  },
  {
    icon: CheckCircle,
    step: "3",
    title: "Make Informed Decisions",
    description: "Compare vendors with confidence using community-driven intelligence.",
  },
];

export function HowItWorksSection({ className }: HowItWorksSectionProps) {
  return (
    <div className={cn("", className)}>
      <h2 className="text-xl font-bold text-foreground text-center mb-6">
        How It Works
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {STEPS.map((step) => (
          <div key={step.step} className="text-center px-2">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-secondary/20 text-yellow-700 font-bold text-lg mb-3">
              {step.step}
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5">
              {step.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
