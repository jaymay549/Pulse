import { ArrowRight, AlertTriangle, ThumbsUp, Lock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useRef, useState, useEffect } from "react";
import type { CarouselApi } from "@/components/ui/carousel";

// Sample examples for the preview
const sampleItems = [
  {
    type: "warning" as const,
    category: "DMS & CRM",
    quote: "Be very careful with contracts. They auto-renewed us for 3 years without proper notice...",
  },
  {
    type: "win" as const,
    category: "Equity Mining",
    quote: "Increased our service-to-sales conversions by 340% in the first quarter. ROI was immediate.",
  },
  {
    type: "warning" as const,
    category: "Marketing",
    quote: "The reporting was inflated. When we dug into the data, actual attribution was 40% of what they claimed...",
  },
];

const VendorCard = ({ item }: { item: typeof sampleItems[0] }) => (
  <div
    className={`group relative p-6 rounded-2xl bg-white border-2 shadow-sm hover:shadow-lg transition-all duration-300 h-full ${
      item.type === 'warning'
        ? 'border-red-200 hover:border-red-300'
        : 'border-green-200 hover:border-green-300'
    }`}
  >
    {/* Badge */}
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4 ${
      item.type === 'warning' 
        ? 'bg-red-100 text-red-700' 
        : 'bg-green-100 text-green-700'
    }`}>
      {item.type === 'warning' ? (
        <AlertTriangle className="h-3.5 w-3.5" />
      ) : (
        <ThumbsUp className="h-3.5 w-3.5" />
      )}
      {item.type === 'warning' ? 'CONCERN' : 'RECOMMENDED'}
    </div>
    
    {/* Category */}
    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
      {item.category}
    </p>
    
    {/* Quote */}
    <p className="text-foreground/80 text-base leading-relaxed mb-4 italic">
      "{item.quote}"
    </p>
    
    {/* Hidden vendor */}
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
      <Lock className="h-3 w-3" />
      <span>Vendor name hidden</span>
    </div>
  </div>
);

const VendorIntelSection = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  
  const autoplayPlugin = useRef(
    Autoplay({ delay: 3000, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-muted/30 to-background overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header - Unified with other sections */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-foreground/70 mb-6">
            <Shield className="h-4 w-4 text-primary" />
            Raw Vendor Intel
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4">
            Avoid Costly Vendor Mistakes
          </h2>
          <p className="text-xl text-foreground/70 max-w-xl mx-auto">
            Real concerns and wins from dealers who've already been there.
          </p>
        </div>

        {/* Mobile Carousel */}
        <div className="sm:hidden mb-12">
          <Carousel
            setApi={setApi}
            opts={{
              align: "start",
              loop: true,
            }}
            plugins={[autoplayPlugin.current]}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {sampleItems.map((item, i) => (
                <CarouselItem key={i} className="pl-4 basis-[85%]">
                  <VendorCard item={item} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          
          {/* Dot indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {sampleItems.map((_, i) => (
              <button
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  current === i ? 'bg-primary w-4' : 'bg-foreground/20'
                }`}
                onClick={() => api?.scrollTo(i)}
              />
            ))}
          </div>
        </div>

        {/* Desktop Grid */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          {sampleItems.map((item, i) => (
            <VendorCard key={i} item={item} />
          ))}
        </div>

        {/* Stats row - inline on mobile */}
        <div className="flex justify-center items-center gap-3 sm:gap-6 mb-8 sm:mb-10 text-sm sm:text-base">
          <span className="text-foreground"><strong className="text-base sm:text-2xl">1,300+</strong> reviews</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-red-600"><strong className="text-base sm:text-2xl">435+</strong> concerns</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-green-600"><strong className="text-base sm:text-2xl">865+</strong> wins</span>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button 
            variant="yellow" 
            size="lg" 
            className="font-black group"
            asChild
          >
            <a href="#pricing">
              Join Circles
              <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default VendorIntelSection;
