import { Card } from "@/components/ui/card";
import { Mail, Bell, Calendar, Smartphone, Clock, Filter } from "lucide-react";

const deliveryMethods = [
  {
    icon: Mail,
    title: "Daily Intelligence Briefing",
    description: "Start your day with a curated digest of overnight insights, trending topics, and critical alerts",
    schedule: "Delivered at 7 AM",
    features: ["Top 5 trends", "Urgent alerts", "Key insights"]
  },
  {
    icon: Calendar,
    title: "Weekly Deep Dive Report",
    description: "Comprehensive analysis of the week's conversations, sentiment shifts, and emerging patterns",
    schedule: "Every Monday morning",
    features: ["Trend analysis", "Vendor sentiment", "Market insights"]
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    description: "Instant notifications when topics matching your interests reach critical mass or sentiment shifts",
    schedule: "Real-time, as it happens",
    features: ["Custom triggers", "Topic tracking", "Sentiment alerts"]
  },
  {
    icon: Filter,
    title: "Custom Filters",
    description: "Set your preferences once—Pulse automatically surfaces only the intelligence you care about",
    schedule: "Always active",
    features: ["Topic filters", "Brand focus", "Role-based"]
  }
];

const PulseDeliveryMethods = () => {
  return (
    <section className="py-20 bg-gradient-to-br from-secondary/5 to-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-secondary/20 px-4 py-2 rounded-full mb-4">
              <Clock className="h-4 w-4 text-secondary" />
              <span className="text-sm font-semibold text-foreground">Intelligence On Your Schedule</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Pulse Works 24/7, You Don't Have To
            </h2>
            <p className="text-xl text-foreground/70 max-w-3xl mx-auto">
              We analyze conversations around the clock and deliver curated intelligence exactly when and how you want it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {deliveryMethods.map((method, index) => {
              const Icon = method.icon;
              return (
                <Card 
                  key={index}
                  className="p-8 border-2 hover:border-secondary/50 hover:shadow-xl transition-all duration-300 group"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-secondary/20 to-secondary/5 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                      <Icon className="h-7 w-7 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-foreground mb-2">{method.title}</h3>
                      <p className="text-foreground/70 text-sm mb-3">{method.description}</p>
                      <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                        <Clock className="h-4 w-4" />
                        <span>{method.schedule}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap mt-4">
                    {method.features.map((feature, i) => (
                      <span 
                        key={i}
                        className="text-xs bg-secondary/10 text-foreground/70 px-3 py-1.5 rounded-full font-medium"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Sample Briefing Preview */}
          <div className="mt-12">
            <Card className="p-8 border-2 border-secondary/30 bg-gradient-to-br from-white to-secondary/5">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Example: Daily Briefing</h3>
                  <p className="text-foreground/60">What you'll see in your inbox every morning</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border-2 border-border shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-foreground to-foreground/90 text-white px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Your Daily Intelligence Briefing</p>
                      <p className="text-lg font-bold">Tuesday, January 21, 2025</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-75">CDG Pulse</p>
                      <p className="text-sm font-semibold">7:00 AM</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-6 bg-red-500 rounded"></div>
                      <h4 className="font-bold text-foreground">🔥 What's Hot Today</h4>
                    </div>
                    <div className="space-y-3 ml-5">
                      <div className="text-sm">
                        <p className="font-semibold text-foreground mb-1">Service Tech Shortage Escalating</p>
                        <p className="text-foreground/70">42 dealers discussed overnight. Vacancy rates hitting 45% in major metros. <span className="text-secondary font-medium cursor-pointer">View conversation →</span></p>
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-foreground mb-1">New DMS Provider Gaining Traction</p>
                        <p className="text-foreground/70">Positive sentiment up 34% this week. Integration improvements noted. <span className="text-secondary font-medium cursor-pointer">See details →</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-6 bg-secondary rounded"></div>
                      <h4 className="font-bold text-foreground">📊 Key Data Points</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4 ml-5">
                      <div className="text-sm">
                        <p className="text-foreground/60">Conversations</p>
                        <p className="text-2xl font-bold text-foreground">247</p>
                        <p className="text-xs text-green-600">+12% vs yesterday</p>
                      </div>
                      <div className="text-sm">
                        <p className="text-foreground/60">Active Dealers</p>
                        <p className="text-2xl font-bold text-foreground">156</p>
                        <p className="text-xs text-green-600">+8% vs yesterday</p>
                      </div>
                      <div className="text-sm">
                        <p className="text-foreground/60">Sentiment</p>
                        <p className="text-2xl font-bold text-foreground">76%</p>
                        <p className="text-xs text-foreground/60">Positive</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-6 bg-orange-500 rounded"></div>
                      <h4 className="font-bold text-foreground">⚡ Your Custom Alerts</h4>
                    </div>
                    <div className="space-y-2 ml-5">
                      <div className="text-sm bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="font-semibold text-foreground mb-1">Alert: "Fixed Ops" topic trending</p>
                        <p className="text-foreground/70">18 new mentions in your filtered topics. <span className="text-secondary font-medium cursor-pointer">Review now →</span></p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 px-6 py-4 text-center">
                  <p className="text-sm text-foreground/60">
                    Delivered daily at 7 AM • Customize your preferences anytime
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PulseDeliveryMethods;
