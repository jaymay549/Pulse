import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import SEO from "@/components/SEO";
import cdgLogo from "@/assets/cdg-circles-logo-black.png";

const AskCommunity = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Load Typeform embed script
    const script = document.createElement('script');
    script.src = '//embed.typeform.com/next/embed.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <>
      <SEO 
        title="Ask the Community - CDG Circles"
        description="Submit your question to the entire CDG Circles network and get expert insights from top dealers across the country."
        ogImage="https://cdgcircles.com/og-retreat-hero.jpg"
        canonical="/ask"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navigation />
        
        <main className="container mx-auto px-4 pt-32 pb-16">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl blur-3xl" />
              <div className="relative py-8">
                <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3 tracking-tight">
                  Ask the Community
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Tap into the collective wisdom of the entire CDG Circles network
                </p>
              </div>
            </div>

            {/* When to Use This */}
            <div className="relative group mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                  <span className="text-primary">→</span>
                  When should you ask the broader network?
                </h2>
                
                <div className="space-y-5">
                  <div className="flex items-start gap-4 group/item">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-primary/20 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <p className="text-base leading-relaxed">
                      <strong className="text-foreground font-semibold">Your group doesn't have the answer</strong>
                      <span className="text-muted-foreground"> — When your Circle's expertise doesn't cover the topic</span>
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-4 group/item">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-primary/20 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <p className="text-base leading-relaxed">
                      <strong className="text-foreground font-semibold">It will resonate broadly</strong>
                      <span className="text-muted-foreground"> — Questions that many dealers are facing or curious about</span>
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-4 group/item">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-primary/20 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <p className="text-base leading-relaxed">
                      <strong className="text-foreground font-semibold">You need diverse perspectives</strong>
                      <span className="text-muted-foreground"> — Topics that benefit from input across different markets and dealership types</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-8 mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
                How It Works
              </h2>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-3">
                    1
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Submit Your Question</h3>
                  <p className="text-sm text-muted-foreground">
                    Share your question with context below
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-3">
                    2
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">We Curate & Prioritize</h3>
                  <p className="text-sm text-muted-foreground">
                    Our analysts review and select the most impactful questions
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-3">
                    3
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Get Your Answer</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive collective insights in your Saturday Summary
                  </p>
                </div>
              </div>
            </div>

            {/* Typeform Embed */}
            <div className="bg-card border border-border rounded-lg p-2 mb-8">
              <div data-tf-live="01KAPPGKZP7RH10HGS0Y790D4G" style={{ minHeight: '500px' }}></div>
            </div>

            {/* Membership Notice */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-6 text-center">
                <p className="text-lg text-foreground">
                  <span className="font-semibold">Only CDG Circles members can ask questions.</span>
                  <br />
                  <span className="text-muted-foreground">Not yet a member? </span>
                  <a 
                    href="/#pricing" 
                    className="text-primary font-semibold hover:text-primary/80 transition-colors underline decoration-primary/30 hover:decoration-primary/60 underline-offset-4"
                  >
                    Join here
                  </a>
                  <span className="text-muted-foreground">.</span>
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-card/50 backdrop-blur-sm py-8 mt-16">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img 
                  src={cdgLogo} 
                  alt="CDG Circles" 
                  className="h-8"
                />
                <p className="text-sm text-muted-foreground">
                  © 2025 CDG Circles. All rights reserved.
                </p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <a href="mailto:circles@cardealershipguy.com" className="text-muted-foreground hover:text-foreground transition-colors">
                  circles@cardealershipguy.com
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default AskCommunity;
