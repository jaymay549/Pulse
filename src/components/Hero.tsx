import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-dealership.jpg";
import cdgLogo from "@/assets/cdg-profile-logo.jpg";
import GainAccessModal from "@/components/GainAccessModal";

const Hero = () => {
  const [showGainAccess, setShowGainAccess] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-white via-primary/5 to-secondary/10">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Professional automotive dealership"
          className="w-full h-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/90 via-white/85 to-white/95" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-4 pt-28 sm:pt-36 pb-20 sm:px-6 lg:px-8">
        <div className="max-w-5xl animate-fade-in">
          {/* CDG Brand Badge */}
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-[#FDD835]/15 backdrop-blur-sm rounded-full border border-[#FDD835]/30">
            <img src={cdgLogo} alt="Car Dealership Guy" className="h-6 w-6 rounded-full" />
            <span className="text-sm font-bold text-foreground">Powered by Car Dealership Guy</span>
          </div>

          <h1 className="mb-8 text-[2.78rem] sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.35] lg:!leading-[1.3] text-foreground tracking-tight">
            Where Top Dealers Share <span className="bg-secondary text-foreground px-1 box-decoration-clone">What Actually Works</span>
          </h1>

          <p className="mb-12 text-xl sm:text-2xl text-foreground/70 leading-relaxed max-w-3xl">
            Real dealership strategies. Raw vendor intel. Like a 20 Group for 10 min a day—without the travel.
          </p>

          {/* Metrics Grid */}
          <div className="mb-12 grid grid-cols-3 gap-2 sm:gap-4 max-w-3xl">
            <div className="bg-white/60 backdrop-blur-sm border border-primary/20 rounded-xl p-3 sm:p-6 md:p-8 text-center hover:shadow-lg transition-all hover:scale-105 hover:border-primary/40">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-1 sm:mb-2">2,500+</div>
              <div className="text-[10px] sm:text-xs md:text-sm font-medium text-foreground/70">Dealer Rooftops</div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-primary/20 rounded-xl p-3 sm:p-6 md:p-8 text-center hover:shadow-lg transition-all hover:scale-105 hover:border-primary/40">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-1 sm:mb-2">$56B+</div>
              <div className="text-[10px] sm:text-xs md:text-sm font-medium text-foreground/70">Revenue</div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-primary/20 rounded-xl p-3 sm:p-6 md:p-8 text-center hover:shadow-lg transition-all hover:scale-105 hover:border-primary/40">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-1 sm:mb-2">50+</div>
              <div className="text-[10px] sm:text-xs md:text-sm font-medium text-foreground/70">U.S. States & Canada</div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" variant="yellow" className="group shadow-lg hover:shadow-xl transition-all" onClick={() => setShowGainAccess(true)}>
              Gain Access
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" className="border-2 hover:bg-foreground/5 transition-all" asChild>
              <a href="#features">Learn More</a>
            </Button>
          </div>

          <div className="mt-8 flex items-start gap-3 sm:gap-6 text-[11px] sm:text-sm text-foreground/60 max-w-xl flex-wrap">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-secondary rounded-full flex-shrink-0"></div>
              <span>Strict Confidentiality</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-secondary rounded-full flex-shrink-0"></div>
              <span>Just 10 min/day</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-secondary rounded-full flex-shrink-0"></div>
              <span>Limited availability</span>
            </div>
          </div>
        </div>
      </div>

      <GainAccessModal isOpen={showGainAccess} onClose={() => setShowGainAccess(false)} />
    </section>
  );
};

export default Hero;
