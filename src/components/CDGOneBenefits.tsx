import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, TrendingUp, Users, Zap, Target, BarChart3, Star } from "lucide-react";

export const CDGOneBenefits = () => {
  const benefits = [
    {
      icon: Sparkles,
      title: "Best Tech Deals",
      description: "Exclusive access to pre-negotiated deals on dealership technology and software",
      features: ["20-40% off leading platforms", "Curated vendor marketplace", "Priority support from vendors"]
    },
    {
      icon: BarChart3,
      title: "Premium Data Insights",
      description: "Real-time market intelligence and competitive analysis tools",
      features: ["Market trends dashboard", "Competitor tracking", "Performance benchmarks"]
    },
    {
      icon: Users,
      title: "Exclusive Community",
      description: "Connect with top-performing dealers in smart-matched groups",
      features: ["AI-powered matching", "Monthly mastermind sessions", "Private WhatsApp groups"]
    },
    {
      icon: Target,
      title: "Strategic Resources",
      description: "Access to premium content and expert guidance",
      features: ["Weekly industry reports", "Expert webinars", "Playbooks & templates"]
    }
  ];

  const pricingTiers = [
    {
      name: "Free",
      price: "$0",
      features: ["Basic community access", "Weekly newsletter", "Limited podcast episodes"],
      cta: "Current Plan",
      highlighted: false
    },
    {
      name: "Pro",
      price: "$99",
      period: "/month",
      features: ["Smart matching", "All podcast episodes", "Priority support", "Basic data insights"],
      cta: "Upgrade to Pro",
      highlighted: false
    },
    {
      name: "CDG One",
      price: "$299",
      period: "/month",
      features: [
        "Everything in Pro",
        "Best tech deals (save 20-40%)",
        "Full data & analytics suite",
        "Executive cohort access",
        "Monthly strategy calls",
        "Vendor negotiation support"
      ],
      cta: "Get CDG One",
      highlighted: true,
      badge: "Best Value"
    }
  ];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full">
          <Star className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold">The Ultimate Dealer Success Platform</span>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          CDG One
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Everything you need to scale your dealership in one comprehensive subscription. 
          Save thousands while accessing the best technology, data, and community.
        </p>
      </div>

      {/* Benefits Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {benefits.map((benefit, idx) => (
          <Card key={idx} className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-3">
                <benefit.icon className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>{benefit.title}</CardTitle>
              <CardDescription>{benefit.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {benefit.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Value Proposition */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            ROI That Makes Sense
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            CDG One members typically save <span className="font-bold text-foreground">$5,000-$15,000 annually</span> on technology deals alone. 
            Combined with strategic insights and peer connections, the value compounds exponentially.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 pt-4">
            <div className="text-center p-4 bg-card rounded-lg">
              <div className="text-3xl font-bold text-primary mb-1">20-40%</div>
              <div className="text-sm text-muted-foreground">Average savings on tech</div>
            </div>
            <div className="text-center p-4 bg-card rounded-lg">
              <div className="text-3xl font-bold text-primary mb-1">50+</div>
              <div className="text-sm text-muted-foreground">Vetted vendor partners</div>
            </div>
            <div className="text-center p-4 bg-card rounded-lg">
              <div className="text-3xl font-bold text-primary mb-1">24/7</div>
              <div className="text-sm text-muted-foreground">Data access & insights</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Comparison */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center">Choose Your Plan</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {pricingTiers.map((tier, idx) => (
            <Card 
              key={idx} 
              className={`relative ${
                tier.highlighted 
                  ? 'border-2 border-primary shadow-lg scale-105' 
                  : 'border'
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-primary to-secondary">
                    {tier.badge}
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  {tier.period && <span className="text-muted-foreground">{tier.period}</span>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full" 
                  variant={tier.highlighted ? "default" : "outline"}
                  disabled={tier.name === "Free"}
                >
                  {tier.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <Card className="bg-gradient-to-r from-primary via-primary/90 to-secondary text-primary-foreground border-0">
        <CardContent className="text-center py-12 space-y-4">
          <h3 className="text-3xl font-bold">Ready to Transform Your Dealership?</h3>
          <p className="text-lg opacity-90 max-w-2xl mx-auto">
            Join CDG One today and start saving while accessing the tools, insights, and connections 
            that top dealers use to stay ahead.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Button size="lg" variant="secondary" className="font-semibold">
              Start Free Trial
              <Zap className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10">
              Schedule a Demo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
