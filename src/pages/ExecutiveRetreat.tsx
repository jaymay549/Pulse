import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navigation from "@/components/Navigation";
import cdgExperiencesLogo from "@/assets/cdg-experiences-logo.png";
import cdgLogo from "@/assets/cdg-profile-logo.jpg";
import { ArrowRight, Mountain, Users, Utensils, TrendingUp, Calendar, MapPin, Check, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { organizationSchema } from "@/lib/structuredData";
import retreatHero from "@/assets/retreat-hero.jpg";
import retreatDinner from "@/assets/retreat-dinner.jpg";
import retreatAdventure from "@/assets/retreat-adventure.jpg";
import kevinDahlstrom from "@/assets/kevin-dahlstrom.jpg";
import { useEffect } from "react";

const TYPEFORM_URL = "https://2tqce38uozv.typeform.com/to/LXAuj8J1#sid=xxxxx";

const ExecutiveRetreat = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const agenda = {
    thursday: [
      { time: "Afternoon", activity: "Arrive in Boulder & check in" },
      { time: "5:00 PM", activity: "Transport to outdoor venue" },
      { time: "6:00 PM", activity: "BBQ dinner at Gold Lake" },
      { time: "7:30 PM", activity: "Keynote: Elite performance mindset" },
      { time: "8:30 PM", activity: "Campfire circle: Introductions & intent setting" },
      { time: "9:00 PM", activity: "Return to hotel, evening social" },
    ],
    friday: [
      { time: "6:30 AM", activity: "Alpine start with coffee & breakfast" },
      { 
        time: "7:30 AM", 
        activity: "Choose your adventure (guided small teams)",
        subItems: [
          "Challenge route: Climb a Flatiron",
          "Moderate route: Extended summit hike",
          "Leisure route: Scenic trail experience"
        ]
      },
      { time: "12:00 PM", activity: "Buffet lunch at hotel" },
      { time: "1:00 PM", activity: "Free time to connect & recharge" },
      { time: "5:00 PM", activity: "Transport to private farm venue" },
      { time: "6:00 PM", activity: "Farm-to-table dinner experience" },
      { time: "8:00 PM", activity: "Keynote: World-class climber & entrepreneur" },
      { time: "10:00 PM", activity: "Return to hotel, evening social" },
    ],
    saturday: [
      { time: "8:30 AM", activity: "Transport to private venue" },
      { time: "9:00 AM", activity: "Gourmet breakfast" },
      { time: "9:30 AM", activity: "Keynote: Wealth & health optimization" },
      { time: "11:00 AM", activity: "Facilitated mastermind discussion" },
      { time: "12:30 PM", activity: "Closing lunch" },
      { time: "1:30 PM", activity: "Return to hotel or optional afternoon hike" },
    ],
  };

  return (
    <>
      <SEO 
        title="Executive Retreat 2026 - CDG Circles"
        description="An exclusive 3-day retreat in Boulder, CO for elite automotive operators. Experience, growth, and camaraderie at 5,000 feet."
        ogImage="https://cdgcircles.com/og-retreat-hero.jpg"
        canonical="/executive-retreat"
        structuredData={organizationSchema}
      />
      
      <div className="min-h-screen bg-background">
        <Navigation 
          customLogo={cdgExperiencesLogo} 
          customNavItems={[
            { label: "Experience", href: "#experience" },
            { label: "Agenda", href: "#agenda" },
            { label: "Speakers", href: "#speakers" },
          ]}
          customCta={{
            label: "Apply to Attend",
            href: TYPEFORM_URL,
            external: true
          }}
        />
        
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-32 pb-20">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${retreatHero})`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
          </div>
          
          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Link 
              to="/#pricing" 
              className="inline-flex items-center gap-2 mb-6 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 border border-amber-400/50 rounded-full backdrop-blur-sm hover:border-amber-400 transition-colors group"
            >
              <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-white font-semibold tracking-wide text-sm sm:text-base whitespace-nowrap">Priority Access for Executive Members</span>
              <ArrowRight className="w-4 h-4 text-amber-400 transition-transform group-hover:translate-x-1 flex-shrink-0" />
            </Link>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Where Elite Operators<br />Come to Grow
            </h1>
            
            <p className="text-lg sm:text-xl lg:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
              A 3-day retreat in Boulder, Colorado for dealership leaders ready to scale, combining world-class speakers, outdoor adventure, and peer connections that drive results.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <div className="flex items-center gap-2 text-white/90">
                <Calendar className="h-5 w-5 text-secondary" />
                <span className="font-semibold">July 16-18, 2026</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <MapPin className="h-5 w-5 text-secondary" />
                <span className="font-semibold">Boulder, Colorado</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <Users className="h-5 w-5 text-secondary" />
                <span className="font-semibold">Limited to 30 Executives</span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center w-full max-w-md sm:max-w-none mx-auto">
              <Button size="lg" variant="yellow" className="group shadow-xl text-base sm:text-lg px-10 py-7 w-full sm:w-auto sm:min-w-[200px]" asChild>
                <a href={TYPEFORM_URL} target="_blank" rel="noopener noreferrer">
                  Apply to Attend
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
              
              <Button size="lg" className="shadow-xl text-base sm:text-lg px-10 py-7 bg-white/10 text-white hover:bg-white/20 border border-white/30 backdrop-blur-sm w-full sm:w-auto sm:min-w-[200px]" asChild>
                <a href="#experience">
                  Learn More
                </a>
              </Button>
            </div>
            
            <p className="mt-6 text-white/70 text-sm">
              Not a Principal or C-suite exec?{" "}
              <a 
                href={TYPEFORM_URL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-secondary hover:text-secondary/80 underline underline-offset-2 transition-colors"
              >
                Join our waitlist for future events →
              </a>
            </p>
          </div>
        </section>

        {/* Why This Matters */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center mb-16">
              {/* CDG Brand Badge */}
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-[#FDD835]/15 backdrop-blur-sm rounded-full border border-[#FDD835]/30">
                <img src={cdgLogo} alt="Car Dealership Guy" className="h-6 w-6 rounded-full" />
                <span className="text-sm font-bold text-foreground">Powered by Car Dealership Guy</span>
              </div>
              
              <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
                Beyond Business As Usual
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                You've built success in one of the toughest industries. Now it's time to build alongside peers 
                who understand what it takes to run dealerships at scale. This isn't networking—it's forging 
                relationships with operators who face the same unique challenges every day.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-8 bg-card border-border hover:border-secondary/50 transition-all">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-6">
                  <TrendingUp className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">World-Class Learning</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Keynotes from elite performers, Navy SEALs, legendary climbers, and wealth optimization experts.
                  Insights on leadership, performance, and strategy that translate directly to your dealership operations.
                </p>
              </Card>

              <Card className="p-8 bg-card border-border hover:border-secondary/50 transition-all">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-6">
                  <Mountain className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">Shared Challenge</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Choose your adventure on Boulder's iconic Flatirons. Whether climbing or hiking,
                  pushing boundaries together builds bonds that last.
                </p>
              </Card>

              <Card className="p-8 bg-card border-border hover:border-secondary/50 transition-all">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-6">
                  <Users className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">True Camaraderie</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Curated group of 30 dealership executives. No vendors, no sales pitches, no posturing.
                  Just authentic connection with peers who get what you're building.
                </p>
              </Card>
            </div>

            <div className="mt-16 text-center">
              <Button size="lg" variant="yellow" className="group shadow-xl text-base sm:text-lg px-10 py-7" asChild>
                <a href={TYPEFORM_URL} target="_blank" rel="noopener noreferrer">
                  Apply to Attend
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Experience Highlights */}
        <section id="experience" className="py-24 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground text-center mb-16">
              The Experience
            </h2>

            <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
              <div>
                <img 
                  src={retreatAdventure} 
                  alt="Rock climbing adventure on Boulder Flatirons" 
                  className="rounded-lg shadow-2xl w-full"
                />
              </div>
              <div>
                <div className="inline-block mb-4 px-3 py-1 bg-background border border-border rounded-full">
                  <span className="text-foreground font-semibold text-sm">Adventure</span>
                </div>
                <h3 className="text-3xl font-bold text-foreground mb-4">
                  Choose Your Challenge
                </h3>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  Start Friday with an alpine adventure on Boulder's legendary Flatirons.
                  Select your route based on experience and comfort level—from technical
                  rock climbing to scenic summit hikes. Small guided teams ensure safety
                  while maximizing the transformative power of shared challenge.
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start">
                    <span className="text-secondary mr-2">•</span>
                    <span>Challenge Route: Climb a Flatiron with expert guides</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-secondary mr-2">•</span>
                    <span>Moderate Route: Extended summit hike with elevation</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-secondary mr-2">•</span>
                    <span>Leisure Route: Scenic trails with incredible views</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
              <div className="order-2 lg:order-1">
                <div className="inline-block mb-4 px-3 py-1 bg-background border border-border rounded-full">
                  <span className="text-foreground font-semibold text-sm">Culinary Excellence</span>
                </div>
                <h3 className="text-3xl font-bold text-foreground mb-4">
                  Phenomenal Food
                </h3>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  Every meal is an experience. From Thursday's outdoor BBQ at Gold Lake to
                  Friday's private farm-to-table dinner, we've curated dining that matches
                  the caliber of the company. Saturday features gourmet breakfast and closing
                  lunch prepared by Colorado's finest chefs.
                </p>
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Premium, not pretentious.</span> Great
                  food brings people together. These meals create the space for the conversations
                  that matter most.
                </p>
              </div>
              <div className="order-1 lg:order-2">
                <img 
                  src={retreatDinner} 
                  alt="Farm-to-table dinner in Colorado mountains" 
                  className="rounded-lg shadow-2xl w-full"
                />
              </div>
            </div>

            <div className="mt-16 text-center">
              <Button size="lg" variant="yellow" className="group shadow-xl text-base sm:text-lg px-10 py-7" asChild>
                <a href={TYPEFORM_URL} target="_blank" rel="noopener noreferrer">
                  Apply to Attend
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Agenda */}
        <section id="agenda" className="py-24 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-4xl sm:text-5xl font-bold text-foreground text-center mb-4">
                Three Days, Infinite Impact
              </h2>
              <p className="text-xl text-muted-foreground text-center mb-16">
                Every moment designed for connection, growth, and unforgettable experiences
              </p>

              {/* Friday */}
              <div className="mb-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-secondary">1</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground">Thursday</h3>
                    <p className="text-muted-foreground">Arrival & Connection</p>
                  </div>
                </div>
                <Card className="p-6 bg-card border-border">
                  <div className="space-y-4">
                    {agenda.thursday.map((item, idx) => (
                      <div key={idx} className="flex gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                        <span className="text-sm font-semibold text-muted-foreground min-w-24">{item.time}</span>
                        <span className="text-foreground">{item.activity}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Saturday */}
              <div className="mb-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-secondary">2</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground">Friday</h3>
                    <p className="text-muted-foreground">Adventure & Insight</p>
                  </div>
                </div>
                <Card className="p-6 bg-card border-border">
                  <div className="space-y-4">
                    {agenda.friday.map((item, idx) => (
                      <div key={idx} className="flex gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                        <span className="text-sm font-semibold text-muted-foreground min-w-24">{item.time}</span>
                        <div className="flex-1">
                          <span className="text-foreground">{item.activity}</span>
                          {item.subItems && (
                            <div className="mt-2 ml-4 space-y-1">
                              {item.subItems.map((subItem, subIdx) => (
                                <div key={subIdx} className="text-sm text-muted-foreground">
                                  • {subItem}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Sunday */}
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-secondary">3</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground">Saturday</h3>
                    <p className="text-muted-foreground">Mastermind & Reflection</p>
                  </div>
                </div>
                <Card className="p-6 bg-card border-border">
                  <div className="space-y-4">
                    {agenda.saturday.map((item, idx) => (
                      <div key={idx} className="flex gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                        <span className="text-sm font-semibold text-muted-foreground min-w-24">{item.time}</span>
                        <span className="text-foreground">{item.activity}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Before Keynotes */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Button size="lg" variant="yellow" className="group shadow-xl text-base sm:text-lg px-10 py-7" asChild>
              <a href={TYPEFORM_URL} target="_blank" rel="noopener noreferrer">
                Apply to Attend
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>
        </section>

        {/* Keynote Speakers Preview */}
        <section id="speakers" className="py-24 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto text-center">
              <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
                Learn from Legends
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed mb-12">
                Three world-class performers sharing hard-won insights from the front lines of extreme achievement.
                These aren't motivational speakers—they're operators who've mastered leadership, risk, and performance 
                at the highest levels. Their lessons translate directly to running and scaling dealerships.
              </p>
              
              <div className="grid md:grid-cols-3 gap-8">
                <Card className="p-8 bg-card border-border text-left hover:border-secondary/50 transition-all">
                  <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center mb-6">
                    <span className="text-3xl">🎖️</span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">Navy SEAL</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Elite special operations veteran sharing frameworks for peak performance under pressure, 
                    leading high-stakes teams, and making critical decisions when everything is on the line.
                  </p>
                  <p className="text-sm text-foreground/80">
                    Learn how operators at the highest level prepare, execute, and adapt when failure isn't an option.
                  </p>
                </Card>
                
                <Card className="p-8 bg-card border-border text-left hover:border-secondary/50 transition-all">
                  <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center mb-6">
                    <span className="text-3xl">🧗</span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">Elite Climber</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    World-class mountaineer and entrepreneur who's built multiple businesses while pushing 
                    boundaries at altitude. Master of calculated risk, team dynamics, and turning passion into profit.
                  </p>
                  <p className="text-sm text-foreground/80">
                    Discover how to assess risk intelligently, build resilient teams, and scale ventures in uncertain environments.
                  </p>
                </Card>
                
                <Card className="p-8 bg-card border-border text-left hover:border-secondary/50 transition-all">
                  <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center mb-6">
                    <span className="text-3xl">💎</span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">Wealth and Health</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Leading authority on sustainable wealth optimization and performance longevity. 
                    Reveals the frameworks high-net-worth operators use to protect assets, maximize returns, and maintain peak health.
                  </p>
                  <p className="text-sm text-foreground/80">
                    The strategies that ensure you're building wealth you can actually enjoy for decades to come.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA After Keynotes */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Button size="lg" variant="yellow" className="group shadow-xl text-base sm:text-lg px-10 py-7" asChild>
              <a href={TYPEFORM_URL} target="_blank" rel="noopener noreferrer">
                Apply to Attend
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>
        </section>

        {/* Social Proof - Confirmed Attendees */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
                  You'll Be In Good Company
                </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Confirmed attendees represent some of the most successful dealership operators in the industry.
                These are the peers you'll be learning and growing alongside.
              </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="p-6 bg-card border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-secondary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">CEO</p>
                      <p className="text-sm text-muted-foreground">Multi-Brand Auto Group</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Leading multiple rooftops across diverse markets with focus on operational excellence
                  </p>
                </Card>

                <Card className="p-6 bg-card border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-secondary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">President & CEO</p>
                      <p className="text-sm text-muted-foreground">26+ Rooftop Network</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Managing large-scale dealership operations with proven track record in growth and efficiency
                  </p>
                </Card>

                <Card className="p-6 bg-card border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-secondary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">Dealer Principal</p>
                      <p className="text-sm text-muted-foreground">Family Automotive Group</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Multi-generational dealership leader innovating while preserving legacy values
                  </p>
                </Card>

                <Card className="p-6 bg-card border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-secondary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">COO</p>
                      <p className="text-sm text-muted-foreground">Regional Auto Group</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Driving operational strategy and performance across multiple high-volume locations
                  </p>
                </Card>

                <Card className="p-6 bg-card border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-secondary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">Managing Partner</p>
                      <p className="text-sm text-muted-foreground">Premium Brand Dealerships</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Building premium customer experiences while scaling luxury brand operations
                  </p>
                </Card>

                <Card className="p-6 bg-card border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-secondary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">CEO</p>
                      <p className="text-sm text-muted-foreground">High-Growth Auto Group</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Rapidly expanding dealership portfolio through strategic acquisitions and innovation
                  </p>
                </Card>
              </div>

              <div className="mt-16 text-center">
                <Card className="p-10 bg-primary/5 border-2 border-primary/20 inline-block shadow-lg">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-2xl">🏆</span>
                    </div>
                  </div>
                  <p className="text-2xl text-foreground font-bold mb-3">
                    Every attendee operates at the executive level
                  </p>
                  <p className="text-lg text-muted-foreground">
                    CEOs, Presidents, Dealer Principals, and C-Suite leaders committed to growth
                  </p>
                </Card>
              </div>
              
              {/* Future Events Callout */}
              <div className="mt-12 p-6 bg-secondary/10 border border-secondary/30 rounded-lg max-w-2xl mx-auto">
                <p className="text-foreground font-semibold mb-2">Different role at your dealership?</p>
                <p className="text-muted-foreground text-sm mb-3">
                  We're planning future retreats for GMs, Fixed Ops Directors, and other dealership leaders. 
                  Apply now to join our interest list and be first to know when we announce events for your role.
                </p>
                <a 
                  href={TYPEFORM_URL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-foreground/80 text-sm font-medium underline underline-offset-2 transition-colors"
                >
                  Join the waitlist →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* CTA After Attendees */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Button size="lg" variant="yellow" className="group shadow-xl text-base sm:text-lg px-10 py-7" asChild>
              <a href={TYPEFORM_URL} target="_blank" rel="noopener noreferrer">
                Apply to Attend
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>
        </section>

        {/* Apply Section */}
        <section id="join" className="py-24 bg-foreground text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>
          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Request Your Spot
              </h2>
              
              <p className="text-xl text-white/80 leading-relaxed mb-12 max-w-3xl mx-auto">
                Three days of world-class speakers, outdoor adventure, and connections with elite dealership operators.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 mb-8">
                <div className="text-center">
                  <div className="text-4xl sm:text-5xl font-bold text-white mb-1">$6,500</div>
                  <p className="text-white/60 text-sm">Excludes airfare & lodging</p>
                </div>
                <div className="hidden sm:block w-px h-16 bg-white/20"></div>
                <div className="text-center">
                  <div className="text-4xl sm:text-5xl font-bold text-secondary mb-1">30</div>
                  <p className="text-white/60 text-sm">Spots Available</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center items-center gap-y-3 sm:gap-x-6 sm:gap-y-2 mb-10 text-white/80 text-sm">
                <span className="flex items-center gap-2"><Check className="h-4 w-4 text-secondary" />3 keynote speakers</span>
                <span className="hidden sm:inline text-white/30">•</span>
                <span className="flex items-center gap-2"><Check className="h-4 w-4 text-secondary" />Guided mountain adventure</span>
                <span className="hidden sm:inline text-white/30">•</span>
                <span className="flex items-center gap-2"><Check className="h-4 w-4 text-secondary" />All meals included</span>
                <span className="hidden sm:inline text-white/30">•</span>
                <span className="flex items-center gap-2"><Check className="h-4 w-4 text-secondary" />Private venues</span>
                <span className="hidden sm:inline text-white/30">•</span>
                <span className="flex items-center gap-2"><Check className="h-4 w-4 text-secondary" />Elite networking</span>
              </div>
              
              <Button size="lg" variant="yellow" className="group shadow-xl text-lg px-12 py-7" asChild>
                <a href={TYPEFORM_URL} target="_blank" rel="noopener noreferrer">
                  Apply to Attend
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Host Section */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center">
              <div className="mb-8">
                <img 
                  src={kevinDahlstrom} 
                  alt="Kevin Dahlstrom" 
                  className="w-32 h-32 rounded-full mx-auto object-cover shadow-lg border-4 border-background"
                />
              </div>
              <h2 className="text-4xl font-bold text-foreground mb-6">
                Your Host
              </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8">
                Kevin brings together his passion for outdoor adventure,
                elite performance, and building meaningful connections among dealership leaders. 
                As the architect of this experience, he has curated every detail to ensure this 
                retreat delivers transformation, not just information.
              </p>
              <p className="text-lg text-muted-foreground">
                This is what happens when an operator who values both excellence and
                authenticity designs an experience for peers who demand the same.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-4xl font-bold text-foreground text-center mb-12">
                Questions?
              </h2>
              
              <div className="space-y-6">
                <Card className="p-6 bg-card border-border">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    What if I'm not a Principal or C-suite executive?
                  </h3>
                  <p className="text-muted-foreground">
                    This inaugural retreat is designed specifically for Principals and C-suite executives, but we're already planning future events for GMs, Fixed Ops Directors, and other dealership leadership roles. Apply now to join our waitlist—you'll be the first to know when we announce events targeting your role.
                  </p>
                </Card>
                
                <Card className="p-6 bg-card border-border">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    What's included in the $6,500?
                  </h3>
                  <p className="text-muted-foreground">
                    All programming, keynote sessions, guided mountain adventures, and meals are included. Airfare and hotel accommodations are not included, allowing you flexibility in your travel arrangements.
                  </p>
                </Card>
                
                <Card className="p-6 bg-card border-border">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Why is there an application process?
                  </h3>
                  <p className="text-muted-foreground">
                    We curate attendees to ensure the right mix of perspectives, experience levels, and dealership types. This creates richer conversations and more valuable connections for everyone.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 bg-muted/30 border-t border-border">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* CDG Brand Badge */}
            <div className="inline-flex items-center mb-6">
              <img src={cdgExperiencesLogo} alt="CDG Experiences" className="h-8" />
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Ready to Elevate Your Dealership?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              July 16-18, 2026 in Boulder. 30 dealership executives. One unforgettable experience.
            </p>
            
            <Button size="lg" variant="yellow" className="group shadow-xl text-base sm:text-lg px-10 py-7" asChild>
              <a href={TYPEFORM_URL} target="_blank" rel="noopener noreferrer">
                Apply to Attend
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            
            <p className="mt-6 text-muted-foreground text-sm">
              Not a Principal or C-suite exec?{" "}
              <a 
                href={TYPEFORM_URL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-secondary hover:text-secondary/80 underline underline-offset-2 transition-colors"
              >
                Join our waitlist for future events →
              </a>
            </p>
          </div>
        </section>
      </div>
    </>
  );
};

export default ExecutiveRetreat;
