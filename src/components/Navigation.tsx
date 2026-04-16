import { Button } from "@/components/ui/button";
import { Menu, X, ArrowRight, Gift } from "lucide-react";
import { useState } from "react";
import defaultLogo from "@/assets/cdg-circles-logo-black.png";

interface NavItem {
  label: string;
  href: string;
}

interface NavigationProps {
  basePath?: string;
  withBanner?: boolean;
  customLogo?: string;
  customNavItems?: NavItem[];
  customCta?: {
    label: string;
    href: string;
    external?: boolean;
  } | null;
}

const Navigation = ({ basePath = "/", withBanner = false, customLogo, customNavItems, customCta }: NavigationProps) => {
  const logo = customLogo || defaultLogo;
  const [isOpen, setIsOpen] = useState(false);

  const defaultNavItems: NavItem[] = [
    { label: "Features", href: `${basePath}#features` },
    { label: "Pricing", href: `${basePath}#pricing` },
    { label: "FAQ", href: `${basePath}#faq` },
    { label: "Referral", href: "/referral" },
  ];

  const navItems = customNavItems || defaultNavItems;
  const cta = customCta === null ? null : (customCta || { label: "Join Now", href: `${basePath}#pricing` });

  return (
    <nav className={`fixed ${withBanner ? 'top-[68px] sm:top-[88px]' : 'top-0'} left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-foreground/10 shadow-sm transition-all duration-300`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <a href={basePath}>
              <img src={logo} alt="CDG Circles" className="h-8 cursor-pointer" />
            </a>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              item.label === "Referral" ? (
                <a 
                  key={item.label}
                  href={item.href} 
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded-full"
                >
                  <Gift className="h-4 w-4" />
                  {item.label}
                </a>
              ) : (
                <a 
                  key={item.label}
                  href={item.href} 
                  className="text-sm font-semibold text-foreground hover:text-secondary transition-colors relative group"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-secondary transition-all duration-300 group-hover:w-full"></span>
                </a>
              )
            ))}
            <Button variant="outline" size="sm" asChild>
              <a href="/vendor-login">Vendor Login</a>
            </Button>
            {cta && (
              <Button variant="yellow" size="sm" className="group shadow-md hover:shadow-lg transition-shadow" asChild>
                <a
                  href={cta.href}
                  {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {cta.label}
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </Button>
            )}
          </div>
          
          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
          </button>
        </div>
        
        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2 border-t-2 border-foreground/10 pt-4">
            {navItems.map((item) => (
              item.label === "Referral" ? (
                <a 
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-1.5 py-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <Gift className="h-4 w-4" />
                  {item.label}
                </a>
              ) : (
                <a 
                  key={item.label}
                  href={item.href}
                  className="block py-2 text-sm font-bold text-foreground hover:text-secondary transition-colors uppercase tracking-wide"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </a>
              )
            ))}
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href="/vendor-login" onClick={() => setIsOpen(false)}>Vendor Login</a>
            </Button>
            {cta && (
              <Button variant="yellow" size="sm" className="w-full group" asChild>
                <a
                  href={cta.href}
                  {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {cta.label}
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
