import Navigation from "@/components/Navigation";
import VendorHero from "@/components/vendor/VendorHero";
import VendorValue from "@/components/vendor/VendorValue";
import SEO from "@/components/SEO";
import { PasswordGate } from "@/components/PasswordGate";
import footerLogo from "@/assets/cdg-circles-logo-white.png";

const VendorCollective = () => {
  return (
    <PasswordGate correctPassword="cdgvendor2026" sessionKey="vendor_collective_unlocked">
      <div className="min-h-screen">
        <SEO
          title="The Vendor Collective | For Automotive Vendors Who Care"
          description="A Slack community for automotive vendors who want to understand what actually works in dealerships. Better vendors = better products for dealers."
          canonical="/vendor-collective"
        />
        <Navigation 
          customNavItems={[]}
          customCta={{
            label: "Express Interest",
            href: "mailto:circles@cardealershipguy.com?subject=Vendor%20Collective%20Interest"
          }}
        />
        <VendorHero />
        <VendorValue />
        
        {/* Footer */}
        <footer className="py-12 bg-foreground text-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <img src={footerLogo} alt="CDG" className="h-8 mb-4 mx-auto" />
              <p className="text-white/70 mb-6 max-w-md mx-auto font-medium">
                The Vendor Collective by CDG
              </p>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/60 font-medium">
                <a href="/" className="hover:text-secondary transition-colors">CDG Circles (for Dealers)</a>
                <span className="hidden sm:inline">•</span>
                <a href="mailto:circles@cardealershipguy.com" className="hover:text-secondary transition-colors">Contact</a>
              </div>
              <p className="mt-4 text-xs text-white/50 font-medium">
                © 2025 Car Dealership Guy LLC. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </PasswordGate>
  );
};

export default VendorCollective;
