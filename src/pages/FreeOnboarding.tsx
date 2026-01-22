import { useEffect, useState } from "react";
import { Check, Clock, Users, MessageCircle, HelpCircle, Search, ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import SEO from "@/components/SEO";
import footerLogo from "@/assets/cdg-circles-logo-white.png";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const FreeOnboarding = () => {
  const [iframeSrc, setIframeSrc] = useState("https://2tqce38uozv.typeform.com/to/qZRoxHEe");
  const [userTier, setUserTier] = useState<string | null>(null);

  useEffect(() => {
    const checkUserTier = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tier')
          .eq('id', user.id)
          .single();
        if (profile) {
          setUserTier(profile.tier);
        }
      }
    };
    checkUserTier();
  }, []);

  useEffect(() => {
    // Get sid parameter from URL and append to iframe src
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('sid');
    if (sid) {
      setIframeSrc(`https://2tqce38uozv.typeform.com/to/qZRoxHEe#sid=${encodeURIComponent(sid)}`);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-primary/5 to-secondary/10">
      <SEO 
        title="Community Onboarding | CDG Circles - Join Auto Dealer Network"
        description="Complete your profile and join 100s of verified auto dealers. Get ready to connect instantly with dealer insights on WhatsApp."
        ogImage="https://cdgcircles.com/og-retreat-hero.jpg"
        canonical="/free-onboarding"
        noindex={true}
      />
      <Navigation />
      
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/20 rounded-full mb-6">
              <Check className="w-5 h-5 text-secondary" />
              <span className="text-secondary font-semibold">Welcome to CDG Circles</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight">
              Let's Get You Started
            </h1>
            
            <p className="text-xl text-foreground/70 mb-8 max-w-2xl mx-auto">
              Complete this quick form so we can match you with the right peers and get you connected to the network.
            </p>
          </div>

          {/* What to Expect */}
          <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
            <div className="bg-white/60 backdrop-blur-sm border border-primary/20 rounded-xl p-6 text-center animate-fade-in">
              <Clock className="w-10 h-10 text-primary mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">2-3 Minutes</h3>
              <p className="text-sm text-foreground/70">Complete your profile so we understand your dealership and goals</p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm border border-primary/20 rounded-xl p-6 text-center animate-fade-in">
              <Users className="w-10 h-10 text-primary mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">Community Access</h3>
              <p className="text-sm text-foreground/70">Join the broader dealer network and connect with peers across all markets</p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm border border-primary/20 rounded-xl p-6 text-center animate-fade-in">
              <MessageCircle className="w-10 h-10 text-primary mx-auto mb-3" />
              <div className="flex items-center justify-center gap-2 mb-2">
                <h3 className="font-bold text-foreground">Community Access</h3>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex items-center">
                        <HelpCircle className="w-4 h-4 text-foreground/50 hover:text-foreground/70 transition-colors" />
                      </button>
                    </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                      <p>We onboard new members on a rolling basis to ensure optimal peer matching and community fit.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-foreground/70">You'll receive an invite to the WhatsApp community once your membership is approved</p>
            </div>
          </div>

          {/* Typeform Embed */}
          <div className="bg-white rounded-2xl shadow-xl p-4 mb-12 animate-fade-in" style={{ minHeight: '700px' }}>
            <iframe
              id="community-typeform"
              src={iframeSrc}
              style={{ width: '100%', height: '700px', border: 0 }}
              allow="camera; microphone; autoplay; encrypted-media;"
              title="Community Onboarding Form"
            />
          </div>

          {/* Vendor Intel Callout */}
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-2xl p-8 mb-8 text-center animate-fade-in">
            <Search className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-3">Explore Vendor Intel Now</h2>
            <p className="text-foreground/70 mb-6 max-w-2xl mx-auto">
              While you wait, preview real dealer reviews on 100+ vendors. See what your peers are saying about the tools you're evaluating.
            </p>
            <a 
              href="/vendors"
              className="inline-flex items-center gap-2 bg-yellow-500 text-yellow-950 px-8 py-3 rounded-lg font-bold hover:bg-yellow-400 transition-all shadow-lg"
            >
              <Search className="w-5 h-5" />
              Browse Vendor Reviews
            </a>
            <p className="text-xs text-foreground/50 mt-3">
              Community members get a preview • {' '}
              {userTier === 'free' ? (
                <a href="https://billing.stripe.com/p/login/cN23dQ1g35Tsd3ibII" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/70 inline-flex items-center gap-1">
                  Upgrade to Pro for full access <ArrowRight className="w-3 h-3" />
                </a>
              ) : (
                <a href="https://billing.stripe.com/p/login/cN23dQ1g35Tsd3ibII" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/70">
                  Upgrade to Pro for full access
                </a>
              )}
            </p>
          </div>

          {/* WhatsApp Download Callout */}
          <div className="bg-white/80 backdrop-blur-sm border-2 border-primary/30 rounded-2xl p-8 mb-8 text-center animate-fade-in">
            <MessageCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-3">Get Ready: Download WhatsApp</h2>
            <p className="text-foreground/70 mb-6 max-w-2xl mx-auto">
              Make sure you have WhatsApp installed on your phone before we send your invitation. Download it now so you're ready to connect with dealers instantly.
            </p>
            <a 
              href="https://www.whatsapp.com/download?lang=en"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg"
            >
              <MessageCircle className="w-5 h-5" />
              Download WhatsApp
            </a>
          </div>

          {/* What Happens Next */}
          <div className="max-w-3xl mx-auto bg-white/60 backdrop-blur-sm border border-primary/20 rounded-xl p-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">What Happens Next?</h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Membership Review</h3>
                  <p className="text-foreground/70">We'll review and approve your membership to ensure you're a great fit for the community.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Get Added to Circles</h3>
                  <p className="text-foreground/70">Once approved, you'll be added to the WhatsApp community on the next Tuesday or Thursday.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Start Connecting</h3>
                  <p className="text-foreground/70">Jump into conversations with fellow dealers and start benefitting from peer insights right away.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="text-center mt-12">
            <p className="text-foreground/60 mb-2">Need help?</p>
            <a href="mailto:circles@cardealershipguy.com" className="text-primary font-semibold hover:underline">
              circles@cardealershipguy.com
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-foreground text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <img src={footerLogo} alt="CDG Circles" className="h-8 mb-4 mx-auto" />
            <p className="text-white/70 mb-6 max-w-md mx-auto font-medium">
              A modern peer group for auto dealers. Private dealer chats. Real insights. No travel required.
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

export default FreeOnboarding;
