import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import cdgLogo from "@/assets/cdg-profile-logo.jpg";

const VendorHero = () => {
  return (
    <section className="min-h-[70vh] flex items-center bg-gradient-to-br from-white via-primary/5 to-secondary/10 px-6">
      <div className="max-w-md mx-auto text-center pt-24 pb-12">
        {/* CDG Brand Badge */}
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-[#FDD835]/15 backdrop-blur-sm rounded-full border border-[#FDD835]/30">
          <img src={cdgLogo} alt="Car Dealership Guy" className="h-6 w-6 rounded-full" />
          <span className="text-sm font-bold text-foreground">By Car Dealership Guy</span>
        </div>
        
        <h1 className="mb-4 text-3xl sm:text-4xl font-extrabold leading-tight text-foreground tracking-tight">
          The Vendor Collective
        </h1>
        
        <p className="mb-6 text-lg text-foreground/70 leading-relaxed">
          A peer group for automotive vendors who care about getting it right.
        </p>

        <div className="space-y-1 mb-8 text-foreground/60">
          <p>Learn the industry.</p>
          <p>Understand how dealers actually operate.</p>
          <p>Build products that fit.</p>
        </div>
        
        <Button size="lg" variant="yellow" className="shadow-lg w-full sm:w-auto" asChild>
          <a href="mailto:circles@cardealershipguy.com?subject=Vendor%20Collective%20Application">
            Apply to Join
            <ArrowRight className="ml-2 h-5 w-5" />
          </a>
        </Button>
        
        <p className="mt-4 text-sm text-foreground/50">
          Slack community • Application required
        </p>
      </div>
    </section>
  );
};

export default VendorHero;
