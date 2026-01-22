import { Calendar, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Comparison = () => {
  return (
    <section className="py-16 sm:py-24 bg-muted/30 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="mb-8 sm:mb-12 text-center">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-2">
            We're Not a 20 Group.
          </h2>
          <p className="text-xl sm:text-2xl text-foreground/60">
            But we welcome dealers who are in one.
          </p>
        </div>

        {/* Unified Comparison Block */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-white rounded-3xl shadow-lg border overflow-hidden">
            <div className="grid md:grid-cols-2">
              {/* CDG Circles */}
              <div className="p-8 md:border-r border-b md:border-b-0 border-dashed border-muted relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-foreground">CDG Circles</h3>
                    <p className="text-xs text-foreground/50 uppercase tracking-wide">Your daily network</p>
                  </div>
                </div>
                <p className="text-foreground/70 leading-relaxed mb-5">
                  Daily insights from top operators across all brands. Instant peer feedback when you need it.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-secondary/10 text-foreground/70 text-sm px-3 py-1.5 rounded-full font-medium">Daily</span>
                  <span className="bg-secondary/10 text-foreground/70 text-sm px-3 py-1.5 rounded-full font-medium">All Brands</span>
                  <span className="bg-secondary/10 text-foreground/70 text-sm px-3 py-1.5 rounded-full font-medium">Digital</span>
                </div>
              </div>

              {/* 20 Groups */}
              <div className="p-8 relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-foreground">20 Groups</h3>
                    <p className="text-xs text-foreground/50 uppercase tracking-wide">Your quarterly session</p>
                  </div>
                </div>
                <p className="text-foreground/70 leading-relaxed mb-5">
                  Quarterly in-person sessions with brand-specific peer groups for strategic planning.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-primary/10 text-foreground/70 text-sm px-3 py-1.5 rounded-full font-medium">Quarterly</span>
                  <span className="bg-primary/10 text-foreground/70 text-sm px-3 py-1.5 rounded-full font-medium">Single Brand</span>
                  <span className="bg-primary/10 text-foreground/70 text-sm px-3 py-1.5 rounded-full font-medium">In-Person</span>
                </div>
              </div>
            </div>

            {/* Better Together Banner */}
            <div className="bg-gradient-to-r from-secondary/10 via-muted/50 to-primary/10 px-6 py-3 text-center border-t">
              <p className="text-sm font-medium text-foreground/70">
                <span className="text-foreground">Better together.</span> Use both for daily agility + quarterly strategy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Comparison;
