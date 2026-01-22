import { ArrowRight, MessageCircle, Zap, Clock, Crown } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import cdgLogo from "@/assets/cdg-circles-logo-black.png";
import phoneChat from "@/assets/phone-chat-square.png";
import benFaricy from "@/assets/ben-faricy.jpg";
import lizaBorches from "@/assets/liza-borches.jpg";
import michaelSpiegl from "@/assets/michael-spiegl.png";
import danielCrainic from "@/assets/daniel-crainic.jpg";

const NADA = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const testimonials = [
    { image: michaelSpiegl, quote: "Like a 20 group for 10 minutes a day.", name: "Michael Spiegl", company: "Dealer Principal, WE Auto" },
    { image: benFaricy, quote: "Where top dealers trade playbooks, not theory.", name: "Ben Faricy", company: "Faricy Boys Automotive" },
    { image: lizaBorches, quote: "Access to operators solving the same challenges.", name: "Liza Borches", company: "Carter Myers Automotive" },
    { image: danielCrainic, quote: "The room I've been looking for my entire career.", name: "Daniel Crainic", company: "Time Auto Group" },
  ];

  useEffect(() => {
    const testimonialTimer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(testimonialTimer);
  }, []);

  useEffect(() => {
    // Feb 9, 2026 at 11:59:59 PM EST (UTC-5)
    const targetDate = new Date("2026-02-10T04:59:59Z");

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-primary/5 to-secondary/10 flex flex-col">
      <SEO
        title="CDG Circles | NADA 2026"
        description="Your unfair advantage starts here. Join 2,500+ dealers sharing real intel."
        canonical="/nada"
      />
      
      {/* Header - Logo only */}
      <div className="pt-8 pb-4 px-6 text-center">
        <img src={cdgLogo} alt="CDG Circles" className="h-8 mx-auto" />
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-8">
        <div className="text-center max-w-md mx-auto">
          {/* Big Hook */}
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4 text-foreground tracking-tight">
            Your unfair advantage is{" "}
            <span className="bg-secondary text-foreground px-1">one tap away</span>
          </h1>
          
          <p className="text-lg text-foreground/70 mb-2">
            Join a private dealer-only chat group now.
          </p>
          <p className="text-sm text-foreground/50 mb-6">
            Get answers on vendor decisions, pay plans, OEM pressure, service retention, AI chat tools, hiring, F&I, inventory management, and&nbsp;more.
          </p>

          {/* Phone Image */}
          <div className="relative mx-auto mb-6 w-full max-w-[380px] sm:max-w-[360px] animate-fade-in">
            <div className="absolute inset-0 bg-secondary/20 rounded-3xl blur-3xl transform scale-95"></div>
            <img 
              src={phoneChat} 
              alt="CDG Circles on WhatsApp" 
              className="relative w-full rounded-2xl shadow-2xl border-4 border-white/80"
            />
          </div>

          {/* Testimonials - Rotating */}
          <div className="mb-4 h-16 flex items-center justify-center overflow-hidden">
            <div 
              key={currentTestimonial} 
              className="flex items-center gap-3 px-2"
              style={{
                animation: 'slideIn 0.5s ease-out forwards',
              }}
            >
              <img 
                src={testimonials[currentTestimonial].image} 
                alt={testimonials[currentTestimonial].name} 
                className="w-10 h-10 rounded-full object-cover border border-primary/20 flex-shrink-0" 
              />
              <p className="text-sm text-foreground/70 italic text-left">
                "{testimonials[currentTestimonial].quote}"
                <span className="block text-xs text-foreground/50 not-italic mt-0.5">
                  — {testimonials[currentTestimonial].name}{testimonials[currentTestimonial].company && `, ${testimonials[currentTestimonial].company}`}
                </span>
              </p>
            </div>
          </div>
          <style>{`
            @keyframes slideIn {
              from {
                opacity: 0;
                transform: translateX(20px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
          `}</style>


          {/* Countdown Timer */}
          <div className="mb-6 p-4 bg-foreground/5 rounded-xl border border-foreground/10">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Only 250 Spots</span>
            </div>
            <p className="text-xs text-foreground/50 mb-3">This batch closes Feb 9 — then the waitlist begins</p>
            <div className="flex justify-center gap-3">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{timeLeft.days}</div>
                <div className="text-[10px] text-foreground/50 uppercase">Days</div>
              </div>
              <div className="text-2xl font-bold text-foreground/30">:</div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{String(timeLeft.hours).padStart(2, '0')}</div>
                <div className="text-[10px] text-foreground/50 uppercase">Hours</div>
              </div>
              <div className="text-2xl font-bold text-foreground/30">:</div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{String(timeLeft.minutes).padStart(2, '0')}</div>
                <div className="text-[10px] text-foreground/50 uppercase">Mins</div>
              </div>
              <div className="text-2xl font-bold text-foreground/30">:</div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{String(timeLeft.seconds).padStart(2, '0')}</div>
                <div className="text-[10px] text-foreground/50 uppercase">Secs</div>
              </div>
            </div>
          </div>

          {/* Three Tier CTAs */}
          <div className="space-y-3">
            {/* Community Access */}
            <Link to="/upgrade" className="block">
              <div className="bg-white/80 backdrop-blur-sm border border-primary/20 rounded-xl p-4 hover:border-primary/40 hover:shadow-lg transition-all group">
                <div className="flex items-center justify-between">
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <MessageCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-bold text-foreground">Community</span>
                      <span className="text-sm font-medium text-foreground/60">$1/mo</span>
                    </div>
                    <p className="text-xs text-foreground/60">Topic chats, Q&A, community access</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
                </div>
              </div>
            </Link>

            {/* Pro Access */}
            <a href="https://buy.stripe.com/fZu28raHEe0W6u07iE3oA0h" target="_blank" rel="noopener noreferrer" data-rewardful className="block">
              <div className="bg-secondary rounded-xl p-4 hover:bg-secondary/90 transition-all group relative overflow-hidden shadow-lg">
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-foreground/10 rounded text-[10px] font-bold uppercase text-foreground">
                  Most Popular
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-left flex-1 min-w-0 pr-16">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <Zap className="h-4 w-4 text-foreground flex-shrink-0" />
                      <span className="font-bold text-foreground">Pro</span>
                      <span className="text-sm font-medium text-foreground/70">$99/mo</span>
                    </div>
                    <p className="text-xs text-foreground/70">Private dealer chat, peer matching</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-foreground/40 group-hover:text-foreground group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </div>
            </a>

            {/* Executive Access */}
            <a href="https://buy.stripe.com/fZuaEXbLI9KG9GcbyU3oA0p" target="_blank" rel="noopener noreferrer" data-rewardful className="block">
              <div className="bg-foreground rounded-xl p-4 hover:bg-foreground/90 transition-all group relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <Crown className="h-4 w-4 text-secondary flex-shrink-0" />
                      <span className="font-bold text-white">Executive</span>
                      <span className="text-sm font-medium text-white/70">$299/mo</span>
                    </div>
                    <p className="text-xs text-white/70">OEM chats, multiple rooms, priority answers</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-white/40 group-hover:text-secondary group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
                </div>
              </div>
            </a>
          </div>

          {/* Trust Line */}
          <p className="mt-8 text-xs text-foreground/50">
            🔒 100% confidential • Full compliance • Cancel anytime
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="py-6 px-6 text-center border-t border-foreground/10">
        <p className="text-xs text-foreground/40">
          © 2025 Car Dealership Guy LLC
        </p>
      </div>
    </div>
  );
};

export default NADA;
