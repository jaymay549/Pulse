import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const FinalCTA = () => {
  return (
    <section className="py-20 bg-primary relative overflow-hidden">
      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 max-w-4xl mx-auto leading-tight">
          Join Circles Today
        </h2>
        
        <p className="text-xl text-primary-foreground/90 mb-10 max-w-2xl mx-auto leading-relaxed">
          Limited availability
        </p>
        
        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" variant="yellow" className="group shadow-lg hover:shadow-xl transition-all" asChild>
            <a href="#pricing">
              Join Circles
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            className="border-2 border-primary-foreground bg-transparent text-primary-foreground hover:bg-white hover:text-primary transition-all"
            asChild
          >
            <a href="#pricing">View Pricing</a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
