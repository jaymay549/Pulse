import { useState } from "react";
import phoneChat from "@/assets/phone-chat-square-new.png";
import { MessageSquare, Users, ArrowRight, Crown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import GainAccessModal from "@/components/GainAccessModal";

const SeeItInAction = () => {
  const [showGainAccess, setShowGainAccess] = useState(false);

  return (
    <section className="py-16 sm:py-28 bg-gradient-to-br from-primary/5 via-white to-secondary/5">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tier Progression Visual */}
        <div className="max-w-5xl mx-auto mb-16 sm:mb-24">
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold mb-4 text-foreground text-center">
            Choose Your Level of Access
          </h2>
          <p className="text-lg sm:text-xl text-foreground/70 text-center mb-8 sm:mb-10 max-w-2xl mx-auto">
            Three tiers designed for different needs—from networking to curated peer matching
          </p>
          
          {/* Visual Progression Cards */}
          <div className="flex flex-col md:grid md:grid-cols-3 gap-5 sm:gap-6 relative">
            {/* Connecting arrows - desktop only */}
            <div className="hidden md:flex absolute top-1/2 left-[33%] -translate-y-1/2 -translate-x-1/2 z-10">
              <div className="bg-white rounded-full p-1 shadow-md">
                <ChevronRight className="w-5 h-5 text-foreground/40" />
              </div>
            </div>
            <div className="hidden md:flex absolute top-1/2 left-[67%] -translate-y-1/2 -translate-x-1/2 z-10">
              <div className="bg-white rounded-full p-1 shadow-md">
                <ChevronRight className="w-5 h-5 text-foreground/40" />
              </div>
            </div>

            {/* Community Tier */}
            <div className="relative group">
              <div className="p-6 rounded-2xl bg-white border-2 border-muted hover:border-foreground/20 transition-all shadow-sm hover:shadow-lg h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <Users className="w-6 h-6 text-foreground/60" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">Community</span>
                    <h3 className="font-bold text-lg text-foreground">General Dealer Chat</h3>
                  </div>
                </div>
                <p className="text-foreground/60 text-sm leading-relaxed mb-3">
                  Open dealer discussions for networking. Connect with the community, explore topics, and find your footing.
                </p>
              </div>
            </div>

            {/* Pro Tier */}
            <div className="relative group">
              <div className="p-6 rounded-2xl bg-primary/5 border-2 border-primary/30 hover:border-primary transition-all shadow-sm hover:shadow-lg h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">Pro</span>
                    <h3 className="font-bold text-lg text-foreground">Focused Chats</h3>
                  </div>
                </div>
                <p className="text-foreground/60 text-sm leading-relaxed mb-3">
                  Curated by topic and goals. Join discussions that match your focus area.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Rural</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Urban</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">AI</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Fixed Ops</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">+more</span>
                </div>
                <div className="mt-auto pt-3 border-t border-primary/20">
                  <p className="text-xs text-foreground/50">
                    <span className="font-semibold">Best for:</span> Managers, Directors & operators
                  </p>
                </div>
              </div>
            </div>

            {/* Executive Tier */}
            <div className="relative group">
              <div className="p-6 rounded-2xl bg-foreground text-white border-2 border-secondary/50 hover:border-secondary transition-all shadow-lg hover:shadow-xl h-full flex flex-col">
                <div className="absolute -top-3 right-4 bg-secondary text-foreground text-xs font-bold px-3 py-1 rounded-full">
                  Premium
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <Crown className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-secondary uppercase tracking-wide">Executive</span>
                    <h3 className="font-bold text-lg text-white">Private Circles</h3>
                  </div>
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-3">
                  Your own curated circle. Matched by performance, role, and goals. The ultimate peer group experience.
                </p>
                <div className="mt-auto pt-3 border-t border-white/20">
                  <p className="text-xs text-white/50">
                    <span className="font-semibold">Best for:</span> Dealer Principals, GMs & C-suite
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Real Conversations Section - Separate visual block with more breathing room */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-20 sm:mt-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
          {/* Left - Image */}
          <div className="relative animate-fade-in flex justify-center items-center">
            <div className="relative w-full max-w-md lg:max-w-lg">
              <img 
                src={phoneChat} 
                alt="Live dealer chat showing real-time conversations" 
                className="w-full rounded-3xl shadow-2xl"
              />
              <div className="absolute inset-0 bg-primary/30 rounded-3xl blur-3xl -z-10 opacity-60"></div>
            </div>
          </div>

          {/* Right - Content */}
          <div className="animate-fade-in">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-foreground leading-tight lg:leading-[1.3]">
              Real Conversations<br /><span className="bg-secondary text-foreground px-1 box-decoration-clone">Real Results</span>
            </h2>
            
            <p className="text-xl text-foreground/70 mb-10 leading-relaxed">
              Get straight to the insights that move your business forward. From general networking to focused groups to private circles—strictly confidential at every level.
            </p>

            {/* Key benefits */}
            <div className="space-y-4 mb-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground/80"><strong>Instant answers</strong> from real dealers in minutes, not days</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-secondary" />
                </div>
                <span className="text-foreground/80"><strong>Verified dealers only</strong>—no vendors, no sales pitches</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Crown className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground/80"><strong>Strict confidentiality</strong>—what's shared stays private</span>
              </div>
            </div>

            {/* CTA */}
            <div>
              <Button size="lg" variant="yellow" className="shadow-lg hover:shadow-xl transition-all" onClick={() => setShowGainAccess(true)}>
                Gain Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <GainAccessModal isOpen={showGainAccess} onClose={() => setShowGainAccess(false)} />
    </section>
  );
};

export default SeeItInAction;
