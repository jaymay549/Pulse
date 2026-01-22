import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, TrendingUp, MessageSquare, BarChart3, Users, Shield, Sparkles, ArrowRight, Eye, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import SEO from "@/components/SEO";
import PulseDemoFeed from "@/components/PulseDemoFeed";
import PulseDeliveryMethods from "@/components/PulseDeliveryMethods";
import { PasswordGate } from "@/components/PasswordGate";

const Pulse = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <PasswordGate>
      <SEO
        title="CDG Pulse - Master Intelligence Tool for Auto Dealers"
        description="Access real-time dealer intelligence, trending stories, vendor insights, and dealership conversation analytics. Data-driven insights from the CDG Circles network."
        ogImage="https://cdgcircles.com/og-retreat-hero.jpg"
        canonical="/pulse"
      />
      <div className="min-h-screen bg-background">
        <Navigation />
        
        {/* Hero Section */}
        <section className="pt-32 pb-20 bg-gradient-to-br from-foreground via-foreground to-foreground/95 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
          <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-secondary/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-3xl"></div>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-5xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-secondary/30 backdrop-blur-sm px-5 py-2.5 rounded-full mb-6 border border-secondary/20">
                <Sparkles className="h-4 w-4 text-secondary" />
                <span className="text-sm font-bold text-white">Master Intelligence Platform</span>
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                CDG Pulse
              </h1>
              <p className="text-xl sm:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
                Your personal intelligence analyst. We analyze thousands of dealer conversations 24/7 and deliver only what matters—<span className="text-secondary font-bold">on your schedule</span>.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  variant="secondary" 
                  size="lg" 
                  className="text-lg shadow-xl hover:shadow-2xl"
                  onClick={() => window.location.href = 'mailto:circles@cardealershipguy.com?subject=Pulse%20Demo%20Request'}
                >
                  Schedule a Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="text-lg bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm"
                  onClick={() => document.getElementById('delivery-methods')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  See How It Works
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Statement */}
        <section className="py-16 bg-gradient-to-br from-background to-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-4xl font-bold text-secondary mb-2">5,000+</div>
                  <p className="text-foreground/70">Daily dealer conversations</p>
                </div>
                <div>
                  <div className="text-4xl font-bold text-secondary mb-2">12hrs</div>
                  <p className="text-foreground/70">To manually track trends</p>
                </div>
                <div>
                  <div className="text-4xl font-bold text-secondary mb-2">85%</div>
                  <p className="text-foreground/70">Of insights missed without AI</p>
                </div>
              </div>
              <div className="mt-12 text-center">
                <p className="text-xl text-foreground/80 leading-relaxed">
                  <strong className="text-foreground">The reality:</strong> CDG Circles generates invaluable dealer intelligence every day. But tracking thousands of conversations manually is impossible. Critical trends, vendor shifts, and competitive moves slip through—costing you time, money, and competitive advantage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Delivery Methods - How Intelligence is Consumed */}
        <div id="delivery-methods">
          <PulseDeliveryMethods />
        </div>

        {/* Products Section - Moved up before demo */}
        <section className="py-20 bg-foreground text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50"></div>
          <div className="absolute top-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                  Two Powerful Solutions
                </h2>
                <p className="text-xl text-white/80">
                  Choose the intelligence level that fits your needs
                </p>
              </div>

              {/* ... keep existing product cards ... */}

              <div className="grid md:grid-cols-2 gap-8">
                {/* Individual Product */}
                <Card className="p-8 border-2 border-foreground/20 bg-white hover:border-secondary hover:shadow-2xl transition-all">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-secondary/10 rounded-2xl mb-4">
                      <TrendingUp className="h-8 w-8 text-secondary" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">Pulse Individual</h3>
                    <p className="text-foreground/70">
                      Personal intelligence dashboard
                    </p>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex gap-3">
                      <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground/80">Query the CDG Circles knowledge base with AI-powered search</span>
                    </div>
                    <div className="flex gap-3">
                      <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground/80">Real-time trending topics and vendor sentiment tracking</span>
                    </div>
                    <div className="flex gap-3">
                      <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground/80">Daily intelligence briefings tailored to your interests</span>
                    </div>
                    <div className="flex gap-3">
                      <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground/80">Historical conversation analysis and trend reports</span>
                    </div>
                    <div className="flex gap-3">
                      <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground/80">Competitive intelligence alerts</span>
                    </div>
                  </div>

                  <div className="border-t border-foreground/10 pt-6">
                    <div className="text-center mb-4">
                      <p className="text-3xl font-bold text-foreground mb-1">$299<span className="text-lg font-normal text-foreground/60">/month</span></p>
                      <p className="text-sm text-foreground/60">Perfect for individual dealers and GMs</p>
                    </div>
                    <Button 
                      variant="secondary" 
                      size="lg" 
                      className="w-full"
                      onClick={() => window.location.href = 'mailto:circles@cardealershipguy.com?subject=Pulse%20Individual%20Interest'}
                    >
                      Request Access
                    </Button>
                  </div>
                </Card>

                {/* Enterprise Product */}
                <Card className="p-8 border-2 border-foreground/20 bg-white relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/10 rounded-full blur-2xl"></div>
                  <div className="relative z-10">
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-secondary/20 rounded-2xl mb-4">
                        <Eye className="h-8 w-8 text-secondary" />
                      </div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">Pulse Enterprise</h3>
                      <p className="text-foreground/70">
                        Organization-wide intelligence
                      </p>
                      <div className="inline-flex items-center gap-2 bg-secondary/20 px-3 py-1 rounded-full mt-2">
                        <Sparkles className="h-3 w-3 text-secondary" />
                        <span className="text-xs font-semibold text-foreground">Most Popular</span>
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      <div className="flex gap-3">
                        <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                        <span className="text-foreground/90"><strong className="text-foreground">Everything in Individual</strong>, plus:</span>
                      </div>
                      <div className="flex gap-3">
                        <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                        <span className="text-foreground/80">Aggregated insights from your team's CDG Circles conversations</span>
                      </div>
                      <div className="flex gap-3">
                        <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                        <span className="text-foreground/80">Identify common challenges across your dealership group</span>
                      </div>
                      <div className="flex gap-3">
                        <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                        <span className="text-foreground/80">Anonymous sentiment analysis—understand what your team is really experiencing</span>
                      </div>
                      <div className="flex gap-3">
                        <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                        <span className="text-foreground/80">Leadership dashboard with trending concerns and opportunities</span>
                      </div>
                      <div className="flex gap-3">
                        <Check className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                        <span className="text-foreground/80">Custom reporting and analytics</span>
                      </div>
                    </div>

                    <div className="border-t border-foreground/10 pt-6">
                      <div className="text-center mb-4">
                        <p className="text-3xl font-bold text-foreground mb-1">Custom Pricing</p>
                        <p className="text-sm text-foreground/60">For dealer groups with 5+ rooftops</p>
                      </div>
                      <Button 
                        variant="secondary" 
                        size="lg" 
                        className="w-full shadow-xl"
                        onClick={() => window.location.href = 'mailto:circles@cardealershipguy.com?subject=Pulse%20Enterprise%20Interest'}
                      >
                        Schedule Demo
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Demo - Now after products */}
        <PulseDemoFeed />

        {/* How It Works - Enterprise Transparency */}
        <section className="py-20 bg-gradient-to-br from-background via-muted/30 to-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-secondary/10 px-4 py-2 rounded-full mb-4">
                  <Shield className="h-4 w-4 text-secondary" />
                  <span className="text-sm font-semibold text-foreground">Privacy & Transparency</span>
                </div>
                <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
                  Built on Trust & Transparency
                </h2>
                <p className="text-xl text-foreground/70">
                  How Pulse Enterprise works for dealer groups
                </p>
              </div>

              <div className="space-y-6">
                <Card className="p-8 border-2 hover:shadow-2xl hover:border-secondary/30 transition-all">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-secondary/10 rounded-xl flex items-center justify-center">
                        <Users className="h-7 w-7 text-secondary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-3">Your Team, Your Insights</h3>
                      <p className="text-foreground/70 leading-relaxed">
                        When your GMs and managers join CDG Circles, you can opt into Pulse Enterprise to gain aggregated intelligence from their peer conversations. This helps you understand the collective challenges, trends, and opportunities your leadership team is navigating.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-8 border-2 border-secondary/20 bg-gradient-to-br from-secondary/5 to-transparent hover:shadow-2xl transition-all">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-secondary/20 rounded-xl flex items-center justify-center">
                        <Shield className="h-7 w-7 text-secondary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-3">Privacy First, Always</h3>
                      <p className="text-foreground/70 mb-4 leading-relaxed">
                        Individual conversations remain confidential. Pulse Enterprise provides <strong className="text-foreground">aggregated, anonymized insights</strong> only—patterns, trends, and sentiment across your organization. You'll see themes like "service department challenges" or "vendor concerns," not word-for-word messages.
                      </p>
                      <div className="bg-white border-2 border-secondary/30 p-5 rounded-xl shadow-sm">
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          <strong className="text-foreground">Example:</strong> Instead of seeing "John said X about vendor Y," you'll see <span className="text-secondary font-semibold">"3 of your GMs have expressed concerns about CRM integration this month"</span> with aggregated sentiment data.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-8 border-2 hover:shadow-2xl hover:border-secondary/30 transition-all">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-secondary/10 rounded-xl flex items-center justify-center">
                        <Check className="h-7 w-7 text-secondary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-3">Full Transparency</h3>
                      <p className="text-foreground/70 leading-relaxed">
                        All team members will be notified that their organization uses Pulse Enterprise. We believe in consent and transparency—no secret tracking, just smart intelligence that helps leadership support their teams better.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-8 bg-gradient-to-br from-secondary/10 to-secondary/5 border-2 border-secondary/30 hover:shadow-2xl transition-all">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-secondary/20 rounded-xl flex items-center justify-center">
                        <BarChart3 className="h-7 w-7 text-secondary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-3">Actionable Intelligence</h3>
                      <p className="text-foreground/70 leading-relaxed">
                        Use Pulse Enterprise to identify training opportunities, address systemic issues early, benchmark against industry trends, and understand what's really happening across your dealership group—all while respecting individual privacy.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 bg-background border-t border-border">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
                  Frequently Asked Questions
                </h2>
                <p className="text-xl text-foreground/60">
                  Everything you need to know about Pulse
                </p>
              </div>

              <div className="space-y-4">
                <Card className="p-6 border-2 hover:shadow-lg hover:border-secondary/30 transition-all">
                  <h3 className="text-lg font-bold text-foreground mb-3">How is Pulse different from just reading CDG Circles?</h3>
                  <p className="text-foreground/70 leading-relaxed">
                    CDG Circles has thousands of conversations happening daily. Pulse uses AI to surface the most relevant insights, track trends over time, analyze sentiment, and let you query the entire knowledge base instantly. It's like having a research analyst tracking everything 24/7.
                  </p>
                </Card>

                <Card className="p-6 border-2 hover:shadow-lg hover:border-secondary/30 transition-all">
                  <h3 className="text-lg font-bold text-foreground mb-3">Can individuals see what shows up in my Enterprise dashboard?</h3>
                  <p className="text-foreground/70 leading-relaxed">
                    No. Enterprise insights are aggregated and only visible to authorized leadership. Individual team members only see their own Pulse Individual dashboard and the standard CDG Circles experience.
                  </p>
                </Card>

                <Card className="p-6 border-2 hover:shadow-lg hover:border-secondary/30 transition-all">
                  <h3 className="text-lg font-bold text-foreground mb-3">Will my team members know about Pulse Enterprise?</h3>
                  <p className="text-foreground/70 leading-relaxed">
                    Yes, absolutely. Full transparency is part of our commitment. Team members will be clearly notified that their organization uses Pulse Enterprise for aggregated insights. We believe trust is essential.
                  </p>
                </Card>

                <Card className="p-6 border-2 hover:shadow-lg hover:border-secondary/30 transition-all">
                  <h3 className="text-lg font-bold text-foreground mb-3">Do I need to be a CDG Circles member to use Pulse?</h3>
                  <p className="text-foreground/70 leading-relaxed">
                    Pulse Individual is available to anyone in the auto industry. Pulse Enterprise requires that your team members are active CDG Circles participants, as it aggregates insights from their conversations.
                  </p>
                </Card>

                <Card className="p-6 border-2 hover:shadow-lg hover:border-secondary/30 transition-all">
                  <h3 className="text-lg font-bold text-foreground mb-3">What's the data retention policy?</h3>
                  <p className="text-foreground/70 leading-relaxed">
                    Pulse analyzes conversations in real-time and retains aggregated insights and trend data. Individual conversation details are processed but not stored in identifiable form for Enterprise dashboards. Full data policy available upon request.
                  </p>
                </Card>

                <Card className="p-6 border-2 border-secondary/30 bg-gradient-to-br from-secondary/5 to-transparent hover:shadow-lg transition-all">
                  <h3 className="text-lg font-bold text-foreground mb-3">Is this available now?</h3>
                  <p className="text-foreground/70 leading-relaxed">
                    Pulse is currently in private beta with select dealer groups. We're accepting requests for access and will onboard new users on a rolling basis through Q1 2025. Contact us to get on the waitlist.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 bg-gradient-to-br from-foreground to-foreground/95 text-white relative overflow-hidden border-y-4 border-secondary">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-secondary/30 backdrop-blur-sm px-5 py-2.5 rounded-full mb-6 border border-secondary/20">
                <Sparkles className="h-4 w-4 text-secondary" />
                <span className="text-sm font-bold text-white">Limited Beta Access</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold mb-6">
                Turn Conversations Into Competitive Advantage
              </h2>
              <p className="text-xl text-white/90 mb-8 leading-relaxed">
                Join the private beta and be among the first to access the most powerful dealer intelligence platform. Limited spots available.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  variant="secondary" 
                  size="lg" 
                  className="text-lg shadow-2xl hover:shadow-3xl"
                  onClick={() => window.location.href = 'mailto:circles@cardealershipguy.com?subject=Pulse%20Beta%20Access'}
                >
                  Request Beta Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="text-lg bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm"
                  onClick={() => window.location.href = 'mailto:circles@cardealershipguy.com?subject=Pulse%20Demo%20Request'}
                >
                  Schedule a Demo
                </Button>
              </div>
              <p className="text-sm text-white/60 mt-6">
                Currently onboarding select dealer groups • Rolling access through Q1 2025
              </p>
            </div>
          </div>
        </section>
      </div>
    </PasswordGate>
  );
};

export default Pulse;
