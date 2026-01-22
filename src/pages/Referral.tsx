import Navigation from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, DollarSign, Users, FileText, Calendar, ArrowRight, Sparkles, TrendingUp, Target, Clock, Heart, Quote, Link } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import cdgCirclesLogo from "@/assets/cdg-circles-logo-black.png";
import robCavender from "@/assets/rob-cavender.jpg";
import cdgCirclesPromo from "@/assets/cdg-circles-promo.png";

const earningsData = [
  { referrals: 15, total: 16092, year1: 8046, year2: 8046 },
  { referrals: 30, total: 32184, year1: 16092, year2: 16092 },
  { referrals: 50, total: 53640, year1: 26820, year2: 26820 },
  { referrals: 100, total: 107280, year1: 53640, year2: 53640 },
  { referrals: 250, total: 268200, year1: 134100, year2: 134100 },
  { referrals: 500, total: 536400, year1: 268200, year2: 268200 },
];

const Referral = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation 
        customLogo={cdgCirclesLogo}
        customNavItems={[]}
        customCta={{ label: "Explore Circles", href: "/" }}
      />

      <main className="pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Hero Header */}
          <div className="text-center mb-12 relative">
            <div className="absolute inset-0 -top-8 bg-gradient-to-b from-primary/5 via-primary/3 to-transparent rounded-3xl -z-10" />
            
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              Partner Program
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              CDG Circles<br />
              <span className="text-primary">Referral Program</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-xl mx-auto mb-8">
              Refer qualified operators or executives to CDG Circles and earn a share of the revenue.
            </p>

            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg"
              onClick={() => window.open('https://car-dealership-guy.getrewardful.com/signup', '_blank')}
            >
              Become a Referral Partner
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <p className="text-sm text-muted-foreground mt-4">
              Your referrals get priority placement — they skip the waitlist.
            </p>
          </div>
          {/* What Is CDG Circles? */}
          <div className="mb-8 relative">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/10 to-primary/5 rounded-3xl -z-10" />
            <div className="absolute top-10 right-10 w-32 h-32 bg-secondary/20 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-10 left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl -z-10" />
            
            <div className="p-6 md:p-10">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
                  <Users className="h-4 w-4" />
                  The Product
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">What Is CDG Circles?</h2>
                <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                  A modern peer group for auto dealers — private, curated groups of 20–30 non-competing operators sharing real insights daily.
                </p>
              </div>
              
              {/* Promo Image */}
              <div className="flex justify-center mb-8">
                <img 
                  src={cdgCirclesPromo} 
                  alt="CDG Circles - Where Top Dealers Share What Actually Works" 
                  className="w-full max-w-2xl h-auto rounded-2xl shadow-xl"
                />
              </div>
              
              {/* Key Benefits */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/60 backdrop-blur-sm border border-border/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary mb-1">2,500+</div>
                  <div className="text-sm text-muted-foreground">Dealer rooftops across 50+ states</div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm border border-border/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary mb-1">10 min/day</div>
                  <div className="text-sm text-muted-foreground">No travel required</div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm border border-border/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary mb-1">$99–299/mo</div>
                  <div className="text-sm text-muted-foreground">Accessible to any dealership</div>
                </div>
              </div>
              
              {/* CTA Link */}
              <div className="text-center">
                <a 
                  href="/" 
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Learn more about CDG Circles
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Who Should You Refer? */}
          <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Who Should You Refer?</h2>
              </div>
              <p className="text-foreground mb-4">
                CDG Circles is built for dealership decision-makers who want to learn from their peers:
              </p>
              <ul className="space-y-2 mb-2">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>Dealer Principals &amp; Owners</strong> — running single or multi-store operations</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>General Managers</strong> — leading day-to-day dealership performance</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>GSMs &amp; Operator-Level Managers</strong> — driving sales, F&amp;I, or fixed ops</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>Platform &amp; Group Executives</strong> — overseeing multi-location strategy</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Why Referrals Convert */}
          <Card className="mb-6 border-green-500/20 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Why Referrals Convert</h2>
              </div>

              {/* Market Size */}
              <div className="bg-background/50 rounded-xl p-5 mb-5 border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground">Massive Addressable Market</span>
                </div>
                <p className="text-foreground">
                  <strong>18,000+ U.S. franchised dealerships</strong> and tens of thousands of GMs, GSMs, and operator-level managers — all potential members.
                </p>
              </div>

              {/* Price Accessibility */}
              <div className="bg-background/50 rounded-xl p-5 mb-5 border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground">Priced for Any Dealership</span>
                </div>
                <p className="text-foreground">
                  At <strong>$99–299/month</strong>, CDG Circles is accessible to operators at every level — from single-point dealers to large platform groups.
                </p>
              </div>

              {/* Time Investment */}
              <div className="bg-background/50 rounded-xl p-5 mb-5 border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground">"Like a 20 Group for 10 Minutes a Day"</span>
                </div>
                <p className="text-foreground">
                  No travel. No quarterly commitments. Just real insights from top operators — consumed on their schedule.
                </p>
              </div>

              {/* Feel Good Factor */}
              <div className="bg-background/50 rounded-xl p-5 mb-5 border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <Heart className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground">Dealers Will Thank You</span>
                </div>
                <p className="text-foreground">
                  You're not selling them something — you're <strong>investing in their growth</strong>. This is a resource they'll genuinely appreciate.
                </p>
              </div>

              {/* Testimonial */}
              <div className="bg-primary/5 rounded-xl p-6 border border-primary/10">
                <Quote className="h-8 w-8 text-primary mb-3 opacity-60" />
                <p className="text-foreground italic mb-4">
                  "When Yossi and I first talked about this idea, it filled a real gap — a space for dealers to have open, unfiltered conversations without the formality or competitiveness of a 20 group. I've avoided countless trial-and-error mistakes just by learning from my group's experiences."
                </p>
                <div className="flex items-center gap-3">
                  <img 
                    src={robCavender} 
                    alt="Rob Cavender" 
                    className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                  />
                  <div>
                    <p className="font-semibold text-foreground">Rob Cavender</p>
                    <p className="text-sm text-muted-foreground">COO, Cavender Auto Group</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* The Deal */}
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Referral Compensation</h2>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>30%</strong> of net subscription revenue during the <strong>first 24 months</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Paid <strong>quarterly</strong>, based on cash collected</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Earnings Pro Forma */}
          <Card className="mb-6 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Estimated 2-Year Referral Earnings (30% for 24 Months)</h2>
              </div>

              {/* Chart */}
              <div className="h-64 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={earningsData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="referrals" 
                      label={{ value: 'Monthly Referrals (new members per month)', position: 'bottom', offset: 0, className: 'fill-muted-foreground text-xs' }}
                      className="fill-muted-foreground text-xs"
                    />
                    <YAxis 
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      className="fill-muted-foreground text-xs"
                    />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total 2-Year Earnings']}
                      labelFormatter={(label) => `${label} referrals/month`}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {earningsData.map((_, index) => (
                        <Cell key={`cell-${index}`} className="fill-primary" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 font-semibold text-foreground">Monthly Referrals</th>
                      <th className="text-right py-3 px-2 font-semibold text-foreground">Total 2-Year</th>
                      <th className="text-right py-3 px-2 font-semibold text-foreground">Year 1</th>
                      <th className="text-right py-3 px-2 font-semibold text-foreground">Year 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...earningsData].reverse().map((row) => (
                      <tr key={row.referrals} className="border-b border-border/50">
                        <td className="py-3 px-2 text-foreground font-medium">{row.referrals}</td>
                        <td className="py-3 px-2 text-right text-primary font-semibold">${row.total.toLocaleString()}</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">${row.year1.toLocaleString()}</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">${row.year2.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-sm text-muted-foreground italic">
                Assumes the stated number of new referred members per month, consistently.
              </p>

              {/* Assumptions */}
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Assumptions:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Membership mix: 75% Pro / 25% Executive</li>
                  <li>• Pricing: Pro $297/quarter, Executive $897/quarter</li>
                  <li>• Members remain active for full 24 months (illustrative)</li>
                </ul>
              </div>

              {/* Takeaway */}
              <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-sm text-foreground font-medium">
                  At scale, a small number of trusted partners can generate six-figure earnings over two years through consistent, high-quality referrals.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Mid-page CTA */}
          <div className="mb-6 text-center py-6 px-6 bg-gradient-to-r from-green-500/10 via-green-500/20 to-green-500/10 rounded-2xl border border-green-500/20">
            <p className="text-lg font-semibold text-foreground mb-4">
              Ready to start earning 30% on every referral?
            </p>
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
              onClick={() => window.open('https://car-dealership-guy.getrewardful.com/signup', '_blank')}
            >
              Become a Referral Partner
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* FAQ */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
              
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="credit">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                    How do I get credit for a referral?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Share your unique affiliate link from Rewardful. When someone signs up using your link, you automatically get credit for the referral.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="split">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                    What if someone else also referred the same person?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    First referrer wins. There are no split referrals.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="existing">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                    Can I refer existing Circles members?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    No. Existing members and prospects already in conversation with CDG are not eligible.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sales">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                    Do I handle sales or pricing?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    No. You simply make introductions. CDG handles all pricing, eligibility, onboarding, and placement decisions.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="payment">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                    When do I get paid?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Quarterly, in arrears, based on cash collected. Payments are made via ACH using PayPal or Wise. You'll receive a report with referred members, tiers, and commissions payable.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="exclusive">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                    Is this an exclusive arrangement?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    No. This is non-exclusive. CDG may operate other referral programs or partnerships at its discretion.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="stop">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                    What happens if I stop participating?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Either side can terminate at any time. Earned commissions for valid referrals made prior to termination continue through the full 24-month payout period.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="community">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                    Is the $1 Community tier eligible?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    No. Referral compensation only applies to Pro ($99/mo) and Executive ($299/mo) memberships.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Bottom CTA */}
          <div className="text-center py-8 px-4 md:px-6 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl border border-primary/10">
            <h3 className="text-2xl font-bold text-foreground mb-3">
              Ready to start earning?
            </h3>
            <p className="text-muted-foreground mb-6 px-2">
              Join our referral program and earn 30% for two years on every qualified referral.
            </p>
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 md:px-8 py-6 text-base md:text-lg w-full sm:w-auto"
              onClick={() => window.open('https://car-dealership-guy.getrewardful.com/signup', '_blank')}
            >
              Become a Referral Partner
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Footer note */}
          <p className="text-center text-sm text-muted-foreground mt-8">
            Questions? Email us at{" "}
            <a href="mailto:circles@cardealershipguy.com" className="text-primary hover:underline">
              circles@cardealershipguy.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Referral;
