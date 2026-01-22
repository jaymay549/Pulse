import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import ValueLoss from "@/components/ValueLoss";
import SeeItInAction from "@/components/SeeItInAction";
import VendorIntelSection from "@/components/VendorIntelSection";
import Comparison from "@/components/Comparison";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import SEO from "@/components/SEO";
import { organizationSchema, websiteSchema, productSchema } from "@/lib/structuredData";
import footerLogo from "@/assets/cdg-circles-logo-white.png";

const Index = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema, websiteSchema, productSchema]
  };

  return (
    <div className="min-h-screen">
      <SEO
        title="CDG Circles | Modern Peer Network for Auto Dealers"
        description="Join 500+ verified dealers in structured peer collaboration. Private dealer chats. Curated intelligence. Real insights. No travel required."
        ogImage="https://cdgcircles.com/og-retreat-hero.jpg"
        canonical="/"
        structuredData={structuredData}
      />
      <Navigation />
      <Hero />
      <ValueLoss />
      <div id="features" className="scroll-mt-20">
        <SeeItInAction />
      </div>
      <VendorIntelSection />
      <Comparison />
      <Testimonials />
      <Pricing />
      <div id="faq" className="scroll-mt-20">
        <FAQ />
      </div>
      
      {/* Footer */}
      <footer className="py-12 bg-foreground text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <img src={footerLogo} alt="CDG Circles" className="h-8 mb-4 mx-auto" />
            <p className="text-white/70 mb-6 max-w-md mx-auto font-medium">
              A modern peer group for auto dealers. Real dealership strategies. Honest vendor reviews. No travel required.
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/60 font-medium">
              <a href="https://www.dealershipguy.com/p/privacy-policy/" target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors">Privacy</a>
              <span className="hidden sm:inline">•</span>
              <a href="https://www.dealershipguy.com/p/terms-of-use/" target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors">Terms</a>
              <span className="hidden sm:inline">•</span>
              <a href="https://billing.stripe.com/p/login/cN23dQ1g35Tsd3ibII" target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors">Manage Subscription</a>
              <span className="hidden sm:inline">•</span>
              <a href="/referral" className="hover:text-secondary transition-colors">Referral Program</a>
              <span className="hidden sm:inline">•</span>
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

export default Index;
