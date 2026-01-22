import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, BarChart3, MessageSquare, Database, Search, Sparkles, ThumbsUp, MessageCircle, ArrowUpRight, Zap, Eye } from "lucide-react";

interface FeedItem {
  id: string;
  type: "trending" | "vendor" | "topic" | "insight";
  icon: any;
  title: string;
  description: string;
  content: string;
  tags: string[];
  stats: string;
  engagement?: { likes: number; comments: number; };
}

const feedItems: FeedItem[] = [
  {
    id: "1",
    type: "trending",
    icon: TrendingUp,
    title: "🔥 Trending Now",
    description: "15 dealers discussing in the last hour",
    content: "Service department staffing crisis reaches critical point. Multiple dealers reporting 40%+ tech vacancy rates in metro markets. Regional wage wars emerging as dealers compete for limited talent pool.",
    tags: ["Fixed Ops", "Staffing", "Labor Market"],
    stats: "15 dealers • Last hour",
    engagement: { likes: 23, comments: 8 }
  },
  {
    id: "2",
    type: "vendor",
    icon: BarChart3,
    title: "📊 Vendor Sentiment Shift",
    description: "Positive momentum detected",
    content: "DMS Provider XYZ sees significant sentiment improvement (+23% this month). Dealers consistently praising enhanced integration capabilities, faster API responses, and dramatically improved support response times under new leadership.",
    tags: ["Vendors", "Technology", "DMS"],
    stats: "Sentiment +23% • Tracked over 60 days",
    engagement: { likes: 18, comments: 5 }
  },
  {
    id: "3",
    type: "topic",
    icon: MessageSquare,
    title: "💬 Hot Debate",
    description: "32 dealers actively engaged",
    content: "EV inventory allocation strategy dividing dealer community. Coastal markets pushing for higher allocations while heartland dealers express caution. Regional market dynamics, charging infrastructure, and local incentives driving vastly different approaches.",
    tags: ["Sales", "EV Strategy", "Inventory"],
    stats: "32 dealers • 47 messages • 2 hours ago",
    engagement: { likes: 41, comments: 12 }
  },
  {
    id: "4",
    type: "insight",
    icon: Database,
    title: "💡 Market Intelligence",
    description: "Data-driven insight from 200+ conversations",
    content: "General Manager compensation packages accelerating across premium brands—average increase of 12% YoY. Retention bonuses now standard practice at 78% of luxury dealerships. Performance incentives increasingly tied to customer satisfaction scores rather than pure volume metrics.",
    tags: ["Compensation", "Leadership", "Trends"],
    stats: "200+ conversations analyzed • High confidence",
    engagement: { likes: 34, comments: 15 }
  },
  {
    id: "5",
    type: "trending",
    icon: Zap,
    title: "⚡ Breaking Update",
    description: "Just reported",
    content: "Major OEM announces comprehensive incentive structure overhaul effective Q2 2025. Significant changes to dealer margin calculations and volume bonuses. Early analysis suggests mixed impact across market segments—import dealers may see compression while domestic dealers gain flexibility.",
    tags: ["OEM", "Finance", "Breaking"],
    stats: "Just posted • Developing story",
    engagement: { likes: 12, comments: 3 }
  },
  {
    id: "6",
    type: "vendor",
    icon: Sparkles,
    title: "🚀 Emerging Technology",
    description: "New trend gaining momentum",
    content: "AI-powered sales assistant platforms moving from pilot to production. Eight dealers report measurable improvements in lead response times (avg 3.2 min vs 18 min) and qualification accuracy. Early adopters seeing 23% increase in appointment show rates.",
    tags: ["AI", "Sales Tech", "Innovation"],
    stats: "8 implementations • Positive early results",
    engagement: { likes: 27, comments: 9 }
  }
];

const exampleQueries = [
  "What are dealers saying about EV inventory?",
  "Show me trending service department challenges",
  "Which DMS providers have the best reviews?",
  "What's the average GM compensation by brand?",
  "Are dealers seeing success with AI tools?"
];

const PulseDemoFeed = () => {
  const [activeQuery, setActiveQuery] = useState("");
  const [visibleItems, setVisibleItems] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      feedItems.forEach((item, index) => {
        setTimeout(() => {
          setVisibleItems(prev => [...prev, item.id]);
        }, index * 150);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <section className="py-20 bg-gradient-to-br from-foreground via-foreground/98 to-foreground text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl"></div>
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-secondary/30 backdrop-blur-sm px-5 py-2.5 rounded-full mb-4 border border-secondary/20">
                <Eye className="h-4 w-4 text-secondary" />
                <span className="text-sm font-bold text-white">Curated Intelligence Feed</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold mb-4">Today's Intelligence Briefing</h2>
              <p className="text-xl text-white/80 max-w-2xl mx-auto">The most important insights from thousands of dealer conversations—curated for you</p>
            </div>

            <div className="space-y-5">
              {feedItems.map((item, index) => {
                const Icon = item.icon;
                const isVisible = visibleItems.includes(item.id);
                const typeColors = {
                  trending: "bg-red-500/20 text-red-300 border-red-400/30",
                  vendor: "bg-blue-500/20 text-blue-300 border-blue-400/30",
                  topic: "bg-purple-500/20 text-purple-300 border-purple-400/30",
                  insight: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                };

                return (
                  <Card key={item.id} className={`p-6 border-2 border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-secondary/40 transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: `${index * 100}ms` }}>
                    <div className="flex gap-5">
                      <div className="flex-shrink-0">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 backdrop-blur-sm ${typeColors[item.type]}`}>
                          <Icon className="h-7 w-7" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <h3 className="text-xl font-bold text-white mb-1">{item.title}</h3>
                            <p className="text-sm text-white/60 font-medium">{item.description}</p>
                          </div>
                        </div>
                        <p className="text-white/85 leading-relaxed mb-4 text-[15px]">{item.content}</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {item.tags.map((tag, i) => (
                            <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-secondary/20 text-secondary border border-secondary/30 backdrop-blur-sm">{tag}</span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-white/10">
                          <span className="text-xs text-white/50 font-medium">{item.stats}</span>
                          {item.engagement && (
                            <div className="flex items-center gap-5">
                              <span className="flex items-center gap-1.5 text-sm text-white/70 font-medium"><ThumbsUp className="h-4 w-4" />{item.engagement.likes}</span>
                              <span className="flex items-center gap-1.5 text-sm text-white/70 font-medium"><MessageCircle className="h-4 w-4" />{item.engagement.comments}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-secondary/10 px-5 py-2.5 rounded-full mb-4 border border-secondary/20">
                <Sparkles className="h-4 w-4 text-secondary" />
                <span className="text-sm font-bold text-foreground">AI-Powered Search</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">Ask Anything, Get Instant Insights</h2>
              <p className="text-xl text-foreground/70 max-w-2xl mx-auto">Query the entire CDG Circles knowledge base with natural language</p>
            </div>

            <Card className="p-8 border-2 border-foreground/10 shadow-2xl mb-8">
              <div className="flex gap-3 mb-6">
                <Input type="text" placeholder="Ask me anything about dealer trends, vendors, compensation..." value={activeQuery} onChange={(e) => setActiveQuery(e.target.value)} className="text-base h-12" />
                <Button size="lg" variant="secondary" className="px-6"><Search className="h-5 w-5" /></Button>
              </div>

              <div className="space-y-3 mb-8">
                <p className="text-sm text-foreground/60 font-medium mb-3">Try these example queries:</p>
                <div className="grid gap-2">
                  {exampleQueries.map((query, index) => (
                    <Button key={index} variant="outline" size="sm" className="justify-start text-left h-auto py-3 px-4 hover:bg-secondary/10 hover:text-secondary hover:border-secondary/30 transition-all w-full" onClick={() => setActiveQuery(query)}>
                      <Sparkles className="h-3.5 w-3.5 mr-2 flex-shrink-0 text-secondary" />
                      <span className="text-sm leading-tight">{query}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <div className="bg-muted/50 rounded-xl p-6 border-2 border-secondary/20">
                  <div className="flex gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-secondary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">AI Response</p>
                      <p className="text-sm text-foreground/60">Based on analysis of recent conversations</p>
                    </div>
                  </div>
                  <div className="space-y-4 text-foreground/80 leading-relaxed">
                    <div className="bg-white/50 rounded-lg p-4 border border-secondary/10">
                      <p className="text-[15px] font-semibold text-foreground mb-2">🎯 Actionable Strategy</p>
                      <p className="text-[15px]">Start with 15% EV allocation in metro markets with public charging density {'>'} 50 stations within 10 miles. Test customer demand for 90 days before increasing. Coastal stores: Front-load inventory Q1-Q2 to capture tax credit urgency.</p>
                    </div>
                    <div className="bg-white/50 rounded-lg p-4 border border-secondary/10">
                      <p className="text-[15px] font-semibold text-foreground mb-2">💰 Financial Impact</p>
                      <p className="text-[15px]">Dealers matching inventory to local incentives see 23% faster turn rates. Example: California stores with 25-30% EV mix average 42-day turns vs 67-day national average. Floor plan savings: $450-680 per unit.</p>
                    </div>
                    <div className="bg-white/50 rounded-lg p-4 border border-secondary/10">
                      <p className="text-[15px] font-semibold text-foreground mb-2">⚠️ Risk Mitigation</p>
                      <p className="text-[15px]">Hedge strategy: Negotiate 30-day return windows with OEM reps for initial EV orders. Build service tech capacity before scaling—dealers report 18% higher CSI when service bandwidth matches inventory growth.</p>
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-border/50">
                    <p className="text-xs text-foreground/50"><strong>Sources:</strong> 47 conversations • 32 dealers • Last 14 days</p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="text-center">
              <Button size="lg" variant="secondary" onClick={() => window.location.href = 'mailto:circles@cardealershipguy.com?subject=Pulse%20Demo%20Request'} className="shadow-xl">
                Schedule a Full Demo
                <ArrowUpRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default PulseDemoFeed;
