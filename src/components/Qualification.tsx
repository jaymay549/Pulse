import { Check, X, ArrowRight, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const Qualification = () => {
  const forYou = [
    "Dealer Principals, GMs, or other dealership managers",
    "Operators focused on execution, not just strategy",
    "Leaders committed to implementing, not just listening",
    "Teams ready to share wins and losses transparently"
  ];
  
  const notForYou = [
    "Those looking for a passive networking group",
    "Operators seeking quick fixes without execution commitment",
    "Vendors or solution providers",
    "Leaders unwilling to contribute insights"
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4">
            Is This For You?
          </h2>
          <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
            We're selective. Limited spots ensure quality peer connections.
          </p>
        </div>
        
        <div className="grid gap-8 lg:grid-cols-2 max-w-6xl mx-auto">
          {/* This IS for you */}
          <Card className="p-8 border-2 border-secondary/30 bg-secondary/5">
            <h3 className="text-xl font-semibold text-foreground mb-6">This is for:</h3>
            <ul className="space-y-3">
              {forYou.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
                  {index === 0 ? (
                    <span className="text-foreground/80 flex items-center gap-2">
                      Dealer Principals, GMs, or other dealership managers
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="inline-flex items-center">
                            <Info className="h-4 w-4 text-foreground/50 cursor-pointer hover:text-foreground/70 transition-colors" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="max-w-xs">
                          <p className="text-sm">Including Used Car Directors, Marketing Directors, Service Managers, CFOs, CTOs, and other C-suite executives and department leaders</p>
                        </PopoverContent>
                      </Popover>
                    </span>
                  ) : (
                    <span className="text-foreground/80">{item}</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          
          {/* This is NOT for you */}
          <Card className="p-8 border-2 border-foreground/20 bg-muted">
            <h3 className="text-xl font-semibold text-foreground mb-6">Not a fit for:</h3>
            <ul className="space-y-3">
              {notForYou.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <X className="h-5 w-5 text-foreground/50 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/80">{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        
        {/* CTA */}
        <div className="mt-12 text-center">
          <Button size="lg" variant="yellow" className="shadow-lg hover:shadow-xl transition-all" asChild>
            <a href="#pricing">
              Join Circles
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Qualification;
