import { Quote } from "lucide-react";
import danielCrainic from "@/assets/daniel-crainic.jpg";
import joshPotts from "@/assets/josh-potts.jpg";
import robCavender from "@/assets/rob-cavender.jpg";
import benFaricy from "@/assets/ben-faricy.jpg";
import andyWright from "@/assets/andy-wright.jpg";
import lizaBorches from "@/assets/liza-borches.jpg";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import Autoplay from "embla-carousel-autoplay";

const Testimonials = () => {
  const testimonials = [
    {
      quote: "It's direct access to what's actually working in other dealerships, and a place to bounce ideas and challenges with real operators. Whatever you're tackling, chances are someone's already done it. That first-hand knowledge pushes you to move faster and think bigger.",
      name: "Josh Potts",
      title: "CEO at Mac Haik Auto Group",
      image: joshPotts
    },
    {
      quote: "This is the room l've been looking for my entire career. Everyone here is playing at a different level-no time-wasters, just operators who are serious about growth.",
      name: "Daniel Crainic",
      title: "CEO at Time Auto Group",
      image: danielCrainic
    },
    {
      quote: "When Yossi and I first talked about this idea, it filled a real gap — a space for dealers to have open, unfiltered conversations without the formality or competitiveness of a 20 group. It's hard to find that kind of peer network in your own market, but here I can bounce ideas off people who've already been through the same challenges. I've avoided countless trial-and-error mistakes just by learning from my group's experiences",
      name: "Rob Cavender",
      title: "COO at Cavender Auto Group",
      image: robCavender
    },
    {
      quote: "Circles gives me clarity on what's actually working across the industry — not just in my own market or only within the brands we represent. It's where top dealers trade playbooks, not theory.",
      name: "Ben Faricy",
      title: "Dealer Principal at The Faricy Boys Automotive",
      image: benFaricy
    },
    {
      quote: "Joining Circles Pro was the single best decision I made this year. It's like having a private board of top dealers who actually share what works.",
      name: "Andy Wright",
      title: "Managing Partner at Vinart Dealerships",
      image: andyWright
    },
    {
      quote: "Circles gives me access to other high-performing operators solving the same challenges we face across 26 rooftops.",
      name: "Liza Borches",
      title: "President & CEO, Carter Myers Automotive",
      image: lizaBorches
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-primary/5 via-background to-muted/30 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50"></div>
      <div className="absolute top-10 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-foreground bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text">
            What Top Dealers Are Saying
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto"></div>
        </div>

        <div className="relative">
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            plugins={[
              Autoplay({
                delay: 8000,
              }),
            ]}
            className="w-full max-w-5xl mx-auto"
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {testimonials.map((testimonial, index) => (
                <CarouselItem key={index} className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3">
                  <div className="p-2 h-full">
                    <div className="bg-card border border-border rounded-xl p-8 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden group">
                      {/* Colored accent bar */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary"></div>
                      
                      {/* Subtle background glow on hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      
                      <div className="relative z-10">
                        <Quote className="w-12 h-12 text-primary mb-6 opacity-80" />
                        <p className="text-foreground mb-8 leading-relaxed italic text-base">
                          "{testimonial.quote}"
                        </p>
                        <div className="flex items-center gap-4 pt-4 border-t border-border/50">
                          <img
                            src={testimonial.image}
                            alt={testimonial.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-primary/20 shadow-md"
                          />
                          <div>
                            <p className="font-bold text-foreground text-lg">{testimonial.name}</p>
                            <p className="text-sm text-muted-foreground font-medium">{testimonial.title}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="hidden md:block">
              <CarouselPrevious />
              <CarouselNext />
            </div>
          </Carousel>
        </div>

        <div className="text-center mt-12">
          <Button size="lg" variant="yellow" className="shadow-xl hover:shadow-2xl transition-all hover:scale-105 text-lg px-8 py-6" asChild>
            <a href="#pricing">
              Join These Top Dealers
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
