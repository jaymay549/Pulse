import { Button } from "@/components/ui/button";
import { ArrowRight, X, AlertCircle, CheckCircle, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import SEO from "@/components/SEO";
import footerLogo from "@/assets/cdg-circles-logo-white.png";
import joshPotts from "@/assets/josh-potts.jpg";
import danielCrainic from "@/assets/daniel-crainic.jpg";
import robCavender from "@/assets/rob-cavender.jpg";
import { supabase } from "@/integrations/supabase/client";

const Upgrade = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-foreground via-foreground/95 to-foreground">
      <SEO 
        title="Upgrade to Pro | CDG Circles - Elite Auto Dealer Network"
        description="Join top-performing dealers in professionally led peer groups. Private dealer chats, peer matching, and curated intelligence."
        ogImage="https://cdgcircles.com/og-retreat-hero.jpg"
        canonical="/upgrade"
      />
      <Navigation />
      
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/20 rounded-full mb-6">
              <AlertCircle className="w-5 h-5 text-secondary" />
              <span className="text-secondary font-semibold">Hold on a second</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
              Wait — before you choose Community
            </h1>
            
            <p className="text-2xl text-white/80 mb-8">
              You're about to miss out on:
            </p>
          </div>

          {/* What You're Missing */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-8 animate-fade-in">
            <ul className="space-y-4 text-lg text-white/90">
              <li className="flex items-start gap-3">
                <X className="w-6 h-6 text-secondary shrink-0 mt-1" />
                <span><strong>Private dealer chats</strong> — Curated discussions with vetted dealers</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="w-6 h-6 text-secondary shrink-0 mt-1" />
                <span><strong>Peer matching</strong> — Matched by performance and role with group chair keeping discussions focused</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="w-6 h-6 text-secondary shrink-0 mt-1" />
                <span><strong>Raw vendor intel</strong> — Real reviews and warnings from dealers who've used the tools</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="w-6 h-6 text-secondary shrink-0 mt-1" />
                <span><strong>Monthly roundtables</strong> — Optional live sessions to share wins, challenges, and strategies with your group</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="w-6 h-6 text-secondary shrink-0 mt-1" />
                <span><strong>Network insights</strong> — Weekly data and trends from the entire dealer community</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="w-6 h-6 text-secondary shrink-0 mt-1" />
                <span><strong>Inside track</strong> — Early access to what CDG is building</span>
              </li>
            </ul>
          </div>

          {/* The Math */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-6">The Math:</h2>
            
            <ul className="space-y-3 text-lg text-white/90 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-secondary font-bold">•</span>
                <span><span className="font-bold text-secondary">$150K+</span> in lost vendor negotiations</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-secondary font-bold">•</span>
                <span><span className="font-bold text-secondary">$200K+</span> in process inefficiency</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-secondary font-bold">•</span>
                <span><span className="font-bold text-secondary">$100K+</span> in missed market shifts</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-secondary font-bold">•</span>
                <span><span className="font-bold text-secondary">$125K+</span> in talent gaps</span>
              </li>
            </ul>

            <div className="border-t border-white/20 pt-6 space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-lg sm:text-xl">
                <span className="text-white font-semibold">Opportunity Cost:</span>
                <span className="text-secondary font-bold text-xl sm:text-2xl">$575K</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-lg sm:text-xl">
                <span className="text-white font-semibold">Circles Pro Investment:</span>
                <span className="text-white/80 font-bold">$99 / month</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-xl sm:text-2xl border-t border-white/20 pt-4 mt-4">
                <span className="text-white font-bold">Potential Monthly ROI:</span>
                <span className="text-secondary font-extrabold text-2xl sm:text-3xl">40×</span>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs text-white/60 text-center leading-relaxed">
                Estimates based on aggregated feedback from early CDG Circles members across multiple dealerships. Individual results vary based on dealership size, market conditions, and implementation of peer insights. These figures represent potential opportunity costs identified through member discussions and are not guaranteed outcomes.
              </p>
            </div>
          </div>

          {/* Mid-Page CTA */}
          <div className="text-center my-12 px-4">
            <Button 
              size="xl" 
              variant="secondary" 
              className="group shadow-lg text-base sm:text-lg w-full sm:w-auto max-w-full"
              asChild
            >
              <a 
                href={isAuthenticated ? "https://billing.stripe.com/p/login/cN23dQ1g35Tsd3ibII" : "https://buy.stripe.com/fZu28raHEe0W6u07iE3oA0h"} 
                target="_blank" 
                rel="noopener noreferrer" 
                data-rewardful
              >
                {isAuthenticated ? "Upgrade to Pro" : "Secure Your Spot in Pro"}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1 shrink-0" />
              </a>
            </Button>
            <p className="mt-4 text-white/70 text-sm">
              Limited spots available • Registration closes soon
            </p>
          </div>

          {/* Testimonials */}
          <div className="space-y-6 mb-12">
            <h2 className="text-3xl font-bold text-white text-center mb-8">What Pro Members Say</h2>
            
            <div className="bg-primary/20 border border-primary/30 rounded-2xl p-6 sm:p-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                <img
                  src={joshPotts}
                  alt="Josh Potts"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-secondary/20 shrink-0"
                />
                <div>
                  <blockquote className="text-base sm:text-lg text-white/95 italic leading-relaxed">
                    "It's direct access to what's actually working in other dealerships, and a place to bounce ideas and challenges with real operators. Whatever you're tackling, chances are someone's already done it."
                  </blockquote>
                  <p className="text-white font-semibold mt-3 text-sm sm:text-base">
                    — Josh Potts, CEO at Mac Haik Auto Group
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-primary/20 border border-primary/30 rounded-2xl p-6 sm:p-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                <img
                  src={danielCrainic}
                  alt="Daniel Crainic"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-secondary/20 shrink-0"
                />
                <div>
                  <blockquote className="text-base sm:text-lg text-white/95 italic leading-relaxed">
                    "This is the room l've been looking for my entire career. Everyone here is playing at a different level-no time-wasters, just operators who are serious about growth."
                  </blockquote>
                  <p className="text-white font-semibold mt-3 text-sm sm:text-base">
                    — Daniel Crainic, CEO at Time Auto Group
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-primary/20 border border-primary/30 rounded-2xl p-6 sm:p-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                <img
                  src={robCavender}
                  alt="Rob Cavender"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-secondary/20 shrink-0"
                />
                <div>
                  <blockquote className="text-base sm:text-lg text-white/95 italic leading-relaxed">
                    "I can bounce ideas off people who've already been through the same challenges. I've avoided countless trial-and-error mistakes just by learning from my group's experiences."
                  </blockquote>
                  <p className="text-white font-semibold mt-3 text-sm sm:text-base">
                    — Rob Cavender, COO at Cavender Auto Group
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button 
              size="xl" 
              variant="secondary" 
              className="group shadow-lg text-lg"
              asChild
            >
              <a 
                href={isAuthenticated ? "https://billing.stripe.com/p/login/cN23dQ1g35Tsd3ibII" : "https://buy.stripe.com/fZu28raHEe0W6u07iE3oA0h"} 
                target="_blank" 
                rel="noopener noreferrer" 
                data-rewardful
              >
                {isAuthenticated ? "Upgrade to Pro" : "Join Pro"}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button 
              size="xl" 
              variant="outline"
              className="border-2 border-white bg-white text-black hover:bg-white/90 transition-all text-lg"
              asChild
            >
              <a href="https://buy.stripe.com/5kQaEXeXU4qm2dKbyU3oA0i" target="_blank" rel="noopener noreferrer" data-rewardful>
                I'll Take Community
              </a>
            </Button>
          </div>

          {/* Risk Reversal */}
          <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
            <div className="flex items-center gap-2 text-white/90">
              <Shield className="w-5 h-5 text-secondary" />
              <span className="font-semibold">Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <CheckCircle className="w-5 h-5 text-secondary" />
              <span className="font-semibold">Quarterly terms</span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <CheckCircle className="w-5 h-5 text-secondary" />
              <span className="font-semibold">Join 50+ dealer groups</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-foreground/50 text-white border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <img src={footerLogo} alt="CDG Circles" className="h-8 mb-4 mx-auto" />
            <p className="text-white/70 mb-6 max-w-md mx-auto font-medium">
              A modern peer group for auto dealers. Real dealership strategies. Honest vendor reviews. No travel required.
            </p>
            <div className="flex justify-center gap-6 text-sm text-white/60 font-medium">
              <a href="https://www.dealershipguy.com/p/privacy-policy/" target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors">Privacy</a>
              <span>•</span>
              <a href="https://www.dealershipguy.com/p/terms-of-use/" target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors">Terms</a>
              <span>•</span>
              <a href="https://billing.stripe.com/p/login/cN23dQ1g35Tsd3ibII" target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors">Manage Subscription</a>
              <span>•</span>
              <a href="mailto:circles@cardealershipguy.com" className="hover:text-secondary transition-colors">Contact</a>
            </div>
            <p className="mt-4 text-sm text-white/70">
              <a href="mailto:circles@cardealershipguy.com" className="hover:text-secondary transition-colors">
                circles@cardealershipguy.com
              </a>
            </p>
            <p className="mt-4 text-xs text-white/50 font-medium">
              © 2025 Car Dealership Guy LLC. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Upgrade;
