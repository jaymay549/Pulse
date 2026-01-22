import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useRef, useState, useEffect } from "react";
import type { CarouselApi } from "@/components/ui/carousel";

const ValueLoss = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  
  const autoplayPlugin = useRef(
    Autoplay({ delay: 3500, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  const losses = [
    {
      amount: "$150K+",
      title: "Vendor Strategy",
      description: "Guessing instead of knowing what works."
    },
    {
      amount: "$200K+",
      title: "Process Inefficiency",
      description: "Reinvent what others already solved."
    },
    {
      amount: "$100K+",
      title: "Market Timing",
      description: "Late to shifts others see coming."
    },
    {
      amount: "$125K+",
      title: "Hiring Mistakes",
      description: "Bad hires without proven frameworks."
    }
  ];

  const LossCard = ({ loss }: { loss: typeof losses[0] }) => (
    <Card className="p-6 border border-foreground/10 hover:border-primary/40 transition-all bg-white/80 backdrop-blur-sm hover:shadow-xl group hover:-translate-y-1 h-full">
      <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent mb-2 group-hover:from-primary group-hover:to-primary/70 transition-all">
        {loss.amount}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">{loss.title}</h3>
      <p className="text-sm text-foreground/60 leading-relaxed">{loss.description}</p>
    </Card>
  );

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-white to-muted/30 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(214,100%,50%,0.05)_0%,transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(48,100%,50%,0.05)_0%,transparent_50%)]"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="mb-10 sm:mb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-secondary/10 border border-secondary/30 rounded-full px-4 py-2 mb-6 text-sm font-semibold text-secondary-foreground">
            <span>Limited availability</span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            The Cost of Doing It Alone
          </h2>
          <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
            Every month without peer intel costs you opportunities your competitors are capturing.
          </p>
        </div>
        
        {/* Mobile Carousel */}
        <div className="sm:hidden mb-8">
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
              {losses.map((loss, index) => (
                <CarouselItem key={index} className="pl-4 basis-[80%]">
                  <LossCard loss={loss} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          
          {/* Dot indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {losses.map((_, i) => (
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
        <div className="hidden sm:grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
          {losses.map((loss, index) => (
            <LossCard key={index} loss={loss} />
          ))}
        </div>
        
        {/* ROI Comparison */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/20 rounded-2xl p-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
              <div className="text-center">
                <div className="text-sm font-medium text-foreground/70 mb-2">Annual Cost of Isolation</div>
                <div className="text-4xl font-bold text-foreground">$575K</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-foreground/70 mb-2">Circles Pro Investment</div>
                <div className="text-4xl font-bold text-foreground">$99/month</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-foreground/70 mb-2">Potential Monthly ROI</div>
                <div className="inline-block bg-secondary text-foreground px-3 py-1">
                  <div className="text-4xl font-bold">40×</div>
                </div>
              </div>
            </div>
            
            {/* Disclaimer */}
            <div className="mt-6 pt-6 border-t border-foreground/10">
              <p className="text-xs text-foreground/60 text-center leading-relaxed">
                Estimates based on aggregated feedback from early CDG Circles members across multiple dealerships. Individual results vary based on dealership size, market conditions, and implementation of peer insights. These figures represent potential opportunity costs identified through member discussions and are not guaranteed outcomes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ValueLoss;
