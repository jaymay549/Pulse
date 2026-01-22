import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { MessageCircle, Calendar, BookOpen, Users, LogOut, Bell, Lock, Zap, TrendingUp, Target, PlayCircle, ChevronRight, Newspaper, Briefcase, Menu, BarChart3, LineChart, PieChart, Activity, Star, GraduationCap, Search, Send } from "lucide-react";
import navLogo from "@/assets/cdg-circles-logo-black.png";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CDGOneBenefits } from "@/components/CDGOneBenefits";
import { useTypingAnimation } from "@/hooks/useTypingAnimation";

type UserTier = 'free' | 'pro' | 'executive';

interface UserProfile {
  tier: UserTier;
  email: string;
  first_name?: string;
  last_name?: string;
}

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("community");
  const navigate = useNavigate();
  const { toast } = useToast();

  const exampleQueries = [
    "Best CRM systems for mid-size dealerships",
    "What are dealers saying about EV inventory?",
    "How to improve service department retention",
    "Digital retailing platform recommendations",
    "Winter sales strategies for used vehicles",
    "DMS comparison for high-volume dealers",
    "Customer experience best practices",
    "Inventory management software reviews"
  ];

  const typingText = useTypingAnimation(exampleQueries, 80, 40, 2500);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        navigate("/auth");
      } else {
        setTimeout(() => {
          fetchProfile(newSession.user.id);
        }, 0);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      if (!existingSession) {
        navigate("/auth");
      } else {
        fetchProfile(existingSession.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      
      // Fetch user role from secure user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (roleError && roleError.code !== 'PGRST116') throw roleError;
      
      if (profileData) {
        setProfile({
          tier: (roleData?.role || 'free') as UserTier,
          email: profileData.email,
          first_name: profileData.first_name,
          last_name: profileData.last_name
        });
      } else {
        // Profile doesn't exist, will be created by trigger
        const userEmail = session?.user?.email || '';
        setProfile({
          tier: 'free',
          email: userEmail,
          first_name: null,
          last_name: null
        });
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error loading profile",
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You've been successfully signed out.",
      });
      navigate("/auth");
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const tierDisplayName = profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1);
  const isFreeTier = profile.tier === 'free';
  const isProTier = profile.tier === 'pro';
  const isExecutiveTier = profile.tier === 'executive';
  
  const displayName = profile.first_name && profile.last_name 
    ? `${profile.first_name} ${profile.last_name}` 
    : profile.first_name || profile.email?.split('@')[0] || 'Member';

  const tierBenefits = {
    free: ['Access to community discussions', 'Monthly newsletter', 'Basic dealer resources'],
    pro: ['Smart matching with verified dealers', 'Priority support', 'Exclusive operator access', 'Advanced analytics', 'Monthly industry reports'],
    executive: ['All Pro benefits', 'Executive-only events', 'Direct access to industry leaders', 'Custom market analysis', '1-on-1 strategy sessions']
  };

  const podcastEpisodes = [
    { id: 1, title: 'The Future of Auto Retail', duration: '45:23', image: 'https://images.unsplash.com/photo-1590650153855-d9e808231d41?w=400' },
    { id: 2, title: 'Dealer Success Stories', duration: '38:15', image: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400' },
    { id: 3, title: 'Industry Trends 2024', duration: '52:10', image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400' },
  ];

  const newsItems = [
    { id: 1, title: 'EV Market Shifts: What Dealers Need to Know', time: '2h ago', image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=400' },
    { id: 2, title: 'New Inventory Management Strategies', time: '5h ago', image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400' },
    { id: 3, title: 'Customer Experience in Modern Dealerships', time: '1d ago', image: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=400' },
  ];

  const services = [
    { id: 1, name: 'CDG Recruiting', description: 'Find top talent for your dealership', icon: Briefcase, color: 'bg-blue-500' },
    { id: 2, name: 'CDG Circles', description: 'Join our exclusive dealer community', icon: Users, color: 'bg-purple-500' },
    { id: 3, name: 'Nomad Content', description: 'Premium content creation services', icon: PlayCircle, color: 'bg-green-500' },
  ];

  const pulseProducts = [
    { id: 1, name: 'Market Intelligence Report', description: 'Real-time pricing and inventory analytics', icon: LineChart, price: 'Included in Pro' },
    { id: 2, name: 'Competitive Analysis Dashboard', description: 'Track competitors in your market', icon: BarChart3, price: 'Included in Pro' },
    { id: 3, name: 'Consumer Sentiment Tracker', description: 'Understand buyer behavior trends', icon: PieChart, price: 'Included in Pro' },
    { id: 4, name: 'Dealer Performance Benchmarks', description: 'Compare your metrics against peers', icon: Activity, price: 'Included in Pro' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] bg-card">
                  <div className="flex flex-col gap-6 mt-6">
                    <div className="flex items-center gap-2 px-2">
                      <Badge variant={isFreeTier ? "outline" : "default"}>
                        {tierDisplayName}
                      </Badge>
                    </div>
                    <nav className="flex flex-col gap-2">
                      <Button
                        variant={activeTab === "community" ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => { handleTabChange("community"); setMobileMenuOpen(false); }}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Community
                      </Button>
                      <Button
                        variant={activeTab === "chat" ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => { handleTabChange("chat"); setMobileMenuOpen(false); }}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Chat
                      </Button>
                      <Button
                        variant={activeTab === "search" ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => { handleTabChange("search"); setMobileMenuOpen(false); }}
                      >
                        <Search className="w-4 h-4 mr-2" />
                        AI Search
                      </Button>
                      <Button
                        variant={activeTab === "pulse" ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => { handleTabChange("pulse"); setMobileMenuOpen(false); }}
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        Pulse
                      </Button>
                      <Button
                        variant={activeTab === "podcast" ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => { handleTabChange("podcast"); setMobileMenuOpen(false); }}
                      >
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Podcast
                      </Button>
                      <Button
                        variant={activeTab === "news" ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => { handleTabChange("news"); setMobileMenuOpen(false); }}
                      >
                        <Newspaper className="w-4 h-4 mr-2" />
                        News
                      </Button>
                      <Button
                        variant={activeTab === "services" ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => { handleTabChange("services"); setMobileMenuOpen(false); }}
                      >
                        <Briefcase className="w-4 h-4 mr-2" />
                        Services
                      </Button>
                      <Button
                        variant={activeTab === "cdg-one" ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => { handleTabChange("cdg-one"); setMobileMenuOpen(false); }}
                      >
                        <Star className="w-4 h-4 mr-2" />
                        CDG One
                      </Button>
                      <Button
                        variant={activeTab === "learning" ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => { handleTabChange("learning"); setMobileMenuOpen(false); }}
                      >
                        <GraduationCap className="w-4 h-4 mr-2" />
                        Learning
                      </Button>
                      <Button
                        variant={activeTab === "events" ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => { handleTabChange("events"); setMobileMenuOpen(false); }}
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Events
                      </Button>
                    </nav>
                    <div className="border-t pt-4">
                      <Button variant="outline" className="w-full" onClick={handleSignOut}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <img src={navLogo} alt="CDG Circles" className="h-7" />
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden md:block">{session.user.email}</span>
              <Badge variant={isFreeTier ? "outline" : "default"} className="hidden lg:flex">
                {tierDisplayName}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="hidden sm:flex">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="sm:hidden">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 lg:py-8">
        {/* Desktop Navigation Tabs */}
        <div className="hidden lg:block mb-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full max-w-6xl grid-cols-10 gap-1">
              <TabsTrigger value="community" className="gap-2">
                <Users className="w-4 h-4" />
                <span>Community</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2">
                <MessageCircle className="w-4 h-4" />
                <span>Chat</span>
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-2">
                <Search className="w-4 h-4" />
                <span>AI Search</span>
              </TabsTrigger>
              <TabsTrigger value="pulse" className="gap-2">
                <Activity className="w-4 h-4" />
                <span>Pulse</span>
              </TabsTrigger>
              <TabsTrigger value="podcast" className="gap-2">
                <PlayCircle className="w-4 h-4" />
                <span>Podcast</span>
              </TabsTrigger>
              <TabsTrigger value="news" className="gap-2">
                <Newspaper className="w-4 h-4" />
                <span>News</span>
              </TabsTrigger>
              <TabsTrigger value="services" className="gap-2">
                <Briefcase className="w-4 h-4" />
                <span>Services</span>
              </TabsTrigger>
              <TabsTrigger value="cdg-one" className="gap-2">
                <Star className="w-4 h-4" />
                <span>CDG One</span>
              </TabsTrigger>
              <TabsTrigger value="learning" className="gap-2">
                <GraduationCap className="w-4 h-4" />
                <span>Learning</span>
              </TabsTrigger>
              <TabsTrigger value="events" className="gap-2">
                <Calendar className="w-4 h-4" />
                <span>Events</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>


        {/* Chat Section */}
        {activeTab === "chat" && (
          <div className="space-y-6 mb-8">
            <h2 className="text-2xl font-bold lg:hidden">Chat</h2>
            
            <div className="grid lg:grid-cols-12 gap-6">
              {/* Group List Sidebar */}
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Your Groups
                  </CardTitle>
                  <CardDescription>Active conversations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                  {[
                    { name: "Q1 2025 - Group A", lastMsg: "Looking forward to our next session!", time: "2m ago", unread: 3 },
                    { name: "Q1 2025 - Group B", lastMsg: "Great insights from everyone today", time: "1h ago", unread: 0 },
                    { name: "Executive Circle", lastMsg: "Quarterly review discussion", time: "3h ago", unread: 1 },
                    { name: "Fixed Ops Directors", lastMsg: "Service retention strategies", time: "5h ago", unread: 0 },
                    { name: "General Managers", lastMsg: "Market updates and trends", time: "1d ago", unread: 0 },
                  ].map((group, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        idx === 0 ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-semibold text-sm">{group.name}</h4>
                        <span className="text-xs text-muted-foreground">{group.time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate flex-1">{group.lastMsg}</p>
                        {group.unread > 0 && (
                          <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                            {group.unread}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Chat Window */}
              <Card className="lg:col-span-8">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Q1 2025 - Group A</CardTitle>
                      <CardDescription>12 members · Active</CardDescription>
                    </div>
                    <Badge variant="outline">Circles Member</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Messages Area */}
                  <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                    {[
                      { sender: "John Smith", msg: "Has anyone implemented the new service retention strategies we discussed?", time: "10:30 AM", isMe: false },
                      { sender: "You", msg: "Yes! We started last week and already seeing a 15% improvement in customer callbacks.", time: "10:32 AM", isMe: true },
                      { sender: "Sarah Johnson", msg: "That's impressive! What specific changes did you make?", time: "10:33 AM", isMe: false },
                      { sender: "You", msg: "We focused on follow-up timing and personalized communication. Happy to share our workflow.", time: "10:35 AM", isMe: true },
                      { sender: "Mike Davis", msg: "Would love to see that! We're looking to improve our process too.", time: "10:36 AM", isMe: false },
                      { sender: "John Smith", msg: "Looking forward to our next session!", time: "10:38 AM", isMe: false },
                    ].map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${msg.isMe ? 'order-2' : 'order-1'}`}>
                          {!msg.isMe && <p className="text-xs font-semibold text-muted-foreground mb-1">{msg.sender}</p>}
                          <div className={`rounded-lg p-3 ${msg.isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <p className="text-sm">{msg.msg}</p>
                            <p className={`text-xs mt-1 ${msg.isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {msg.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input Area */}
                  <div className="border-t p-4">
                    <div className="flex items-center gap-2">
                      <Input 
                        placeholder="Type a message..." 
                        className="flex-1"
                      />
                      <Button size="icon">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* AI Search Section */}
        {activeTab === "search" && (
          <div className="space-y-6 mb-8">
            <h2 className="text-2xl font-bold lg:hidden">AI Search</h2>
            
            {/* How It Works Section */}
            <Card className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background border-2 border-primary/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Search className="w-6 h-6 text-primary" />
                  <CardTitle>AI-Powered Dealer Intelligence</CardTitle>
                </div>
                <CardDescription>
                  Your private window into the collective wisdom of 1,000+ dealers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Daily Pulse Analysis</h4>
                      <p className="text-sm text-muted-foreground">
                        Our AI analyzes conversations from 1,000+ dealers every single day, identifying trends, 
                        best practices, and emerging challenges across the industry.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Query Themes</h4>
                      <p className="text-sm text-muted-foreground">
                        Ask about any topic and get insights synthesized from real dealer discussions. 
                        Search for vendors, strategies, market trends, or operational challenges.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Fully Private & Secure</h4>
                      <p className="text-sm text-muted-foreground">
                        All searches and conversations are completely private. Your queries are never shared, 
                        and dealer identities are protected in all results.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fraud Protection Notice */}
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Bell className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-destructive mb-1">Fraud Protection</h4>
                      <p className="text-sm text-muted-foreground">
                        We maintain the integrity of our community. Any member caught manipulating conversations 
                        to harm competitors or artificially boost vendors will be{" "}
                        <span className="font-semibold text-foreground">permanently banned from CDG Circles</span>.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Use Cases */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Use Cases</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      Find Trusted Vendors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Search for vendors based on real dealer experiences and ratings. See what your peers 
                      are actually saying about service providers, not just marketing materials.
                    </p>
                    <Badge variant="outline" className="text-xs">
                      Example: "Best CRM systems for mid-size dealerships"
                    </Badge>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Identify Market Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Discover what topics dealers are discussing most. Stay ahead of industry shifts 
                      and understand emerging challenges before they impact your business.
                    </p>
                    <Badge variant="outline" className="text-xs">
                      Example: "What are dealers saying about EV inventory?"
                    </Badge>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Learn Best Practices
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Access collective dealer wisdom on any operational challenge. Get proven strategies 
                      from peers who have solved similar problems.
                    </p>
                    <Badge variant="outline" className="text-xs">
                      Example: "How to improve service department retention"
                    </Badge>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      Compare Solutions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      See how different vendors, tools, or strategies stack up based on actual dealer feedback. 
                      Make informed decisions backed by community insights.
                    </p>
                    <Badge variant="outline" className="text-xs">
                      Example: "DMS comparison for high-volume dealers"
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Search Interface (Coming Soon) */}
            <Card className="border-2 border-dashed border-muted">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Search className="w-6 h-6 text-primary" />
                  <CardTitle>Search Interface</CardTitle>
                </div>
                <CardDescription>
                  Ask questions and get insights from 1,000+ daily dealer conversations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={typingText}
                    className="w-full pl-11 pr-4 py-3 rounded-lg border border-input bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    disabled
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary animate-pulse" />
                </div>
                <Button className="w-full" size="lg" disabled>
                  <Search className="w-4 h-4 mr-2" />
                  Search with AI
                </Button>
                <div className="text-center pt-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
                    <Zap className="w-4 h-4" />
                    <span className="text-sm font-medium">Coming Soon</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Example Results */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                Example Search Results
              </h3>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Badge variant="outline" className="mb-2">Community Theme</Badge>
                      <CardTitle className="text-base">Service Department Efficiency</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Over the past 30 days, 156 dealers discussed service department optimization. 
                    Key insights include implementing express service lanes, updating scheduling software, 
                    and cross-training technicians. 78% report increased customer satisfaction scores.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    <span>Synthesized from 156 dealer conversations</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Badge variant="secondary" className="mb-2">Vendor Insight</Badge>
                      <CardTitle className="text-base">AutoSync DMS Solutions</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    43 dealers mentioned this vendor in the last quarter. Consistently praised for 
                    responsive support team and seamless integrations. Most common use case: 
                    multi-location inventory management.
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-primary text-primary" />
                      <span>Highly recommended</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      <span>43 dealer mentions</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Badge variant="outline" className="mb-2">Emerging Trend</Badge>
                      <CardTitle className="text-base">Digital Retailing Adoption</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Discussion volume increased 240% in the past 60 days. Dealers are exploring 
                    online financing tools, virtual test drives, and home delivery options. 
                    Main concern: maintaining personal connection with customers.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <span>+240% discussion increase</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Community Section */}
        {activeTab === "community" && (
          <div className="space-y-6 mb-8">
            {/* Welcome Section */}
            <Card className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background border-2 border-primary/20 shadow-lg">
              <CardContent className="pt-8 pb-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        Welcome back, {displayName}!
                      </h1>
                      <Badge variant={isFreeTier ? "outline" : "default"} className="text-sm px-3 py-1">
                        {tierDisplayName}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-4">
                      {isExecutiveTier && "You have access to our most exclusive features and benefits."}
                      {isProTier && "You're enjoying premium features and priority support."}
                      {isFreeTier && "You're part of the CDG Circles community."}
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-foreground/90">Your {tierDisplayName} Benefits:</p>
                      <ul className="grid sm:grid-cols-2 gap-2">
                        {tierBenefits[profile.tier].map((benefit, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-foreground/80">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {isFreeTier && (
                    <div className="flex-shrink-0">
                      <Button asChild variant="default" size="lg" className="gap-2">
                        <a href="https://billing.stripe.com/p/login/cN23dQ1g35Tsd3ibII" target="_blank" rel="noopener noreferrer">
                          <Zap className="w-4 h-4" />
                          Upgrade to Pro
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <h2 className="text-2xl font-bold lg:hidden">Community</h2>
            
            {/* Important Notice */}
            <Card className="border-2 border-secondary/50 bg-secondary/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Bell className="w-6 h-6 text-secondary" />
                  <CardTitle>Cohort Launch: Early January</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/80">
                  You'll receive an invite to the WhatsApp community when groups launch in early January. 
                  This timing allows us to bring as many people to the platform and create the optimal matches for everyone.
                </p>
              </CardContent>
            </Card>

            {/* Community Features */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Smart Matching - Pro/Executive Only */}
              <Card className={`hover:shadow-lg transition-shadow ${isFreeTier ? 'relative overflow-hidden border-2 border-muted' : ''}`}>
                {isFreeTier && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <div className="text-center p-4 bg-card/90 rounded-lg shadow-lg">
                      <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="font-bold text-foreground text-sm">Pro Feature</p>
                      <Button size="sm" variant="secondary" className="mt-2" asChild>
                        <a href="/upgrade">Unlock</a>
                      </Button>
                    </div>
                  </div>
                )}
                <CardHeader>
                  <Target className="w-8 h-8 text-primary mb-2" />
                  <CardTitle className="text-base">Smart Matching</CardTitle>
                  <CardDescription className="text-xs">AI-powered cohort matching</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get matched with operators in similar market sizes and challenges
                  </p>
                  {!isFreeTier && (
                    <Button variant="outline" disabled className="w-full" size="sm">
                      Coming in January
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* WhatsApp Community - All Tiers */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <MessageCircle className="w-8 h-8 text-primary mb-2" />
                  <CardTitle className="text-base">WhatsApp Community</CardTitle>
                  <CardDescription className="text-xs">Join the conversation</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Invite coming in early January when groups launch
                  </p>
                  <Button variant="outline" disabled className="w-full" size="sm">
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              {/* Priority Support - Pro/Executive Only */}
              <Card className={`hover:shadow-lg transition-shadow ${isFreeTier ? 'relative overflow-hidden border-2 border-muted' : ''}`}>
                {isFreeTier && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <div className="text-center p-4 bg-card/90 rounded-lg shadow-lg">
                      <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="font-bold text-foreground text-sm">Pro Feature</p>
                      <Button size="sm" variant="secondary" className="mt-2" asChild>
                        <a href="/upgrade">Unlock</a>
                      </Button>
                    </div>
                  </div>
                )}
                <CardHeader>
                  <TrendingUp className="w-8 h-8 text-primary mb-2" />
                  <CardTitle className="text-base">Priority Support</CardTitle>
                  <CardDescription className="text-xs">Get help when you need it</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Direct access to our team for urgent questions and support
                  </p>
                  {!isFreeTier && (
                    <Button variant="outline" asChild className="w-full" size="sm">
                      <a href="mailto:circles@cardealershipguy.com">Contact Support</a>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Calendar className="w-8 h-8 text-primary mb-2" />
                  <CardTitle className="text-base">Events & Sessions</CardTitle>
                  <CardDescription className="text-xs">Live discussions</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Access exclusive virtual events and peer sessions
                  </p>
                  <Button variant="outline" disabled className="w-full" size="sm">
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <BookOpen className="w-8 h-8 text-primary mb-2" />
                  <CardTitle className="text-base">Resource Library</CardTitle>
                  <CardDescription className="text-xs">Industry insights</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Templates, guides, and best practices
                  </p>
                  <Button variant="outline" disabled className="w-full" size="sm">
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              {/* Executive Only Feature */}
              {isExecutiveTier && (
                <Card className="hover:shadow-lg transition-shadow border-2 border-primary/50">
                  <CardHeader>
                    <Users className="w-8 h-8 text-primary mb-2" />
                    <CardTitle className="text-base">Executive Circle</CardTitle>
                    <CardDescription className="text-xs">Elite operator network</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Exclusive access to C-level operators and strategic insights
                    </p>
                    <Button variant="outline" disabled className="w-full" size="sm">
                      Coming Soon
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Getting Started Section */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-xl">Getting Started</CardTitle>
                <CardDescription>Here's what to expect as a CDG Circles member</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                      1
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Complete Your Profile</h3>
                    <p className="text-xs text-muted-foreground">
                      Help us match you with the right peers by completing your dealership profile (coming soon)
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                      2
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Join Your WhatsApp Group</h3>
                    <p className="text-xs text-muted-foreground">
                      You'll receive your WhatsApp invite in early January when groups launch
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                      3
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Start Connecting</h3>
                    <p className="text-xs text-muted-foreground">
                      Share insights, ask questions, and learn from top operators across the country
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pulse Section - Data Products */}
        {activeTab === "pulse" && (
          <div className="space-y-6 mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Pulse Data Products</h2>
              <p className="text-muted-foreground">Market intelligence and analytics to drive smarter decisions</p>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {pulseProducts.map((product) => (
                <Card key={product.id} className={`hover:shadow-lg transition-all ${isFreeTier ? 'relative overflow-hidden border-2 border-muted' : 'border-2 border-primary/20'}`}>
                  {isFreeTier && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                      <div className="text-center p-4 bg-card/95 rounded-lg shadow-lg max-w-[200px]">
                        <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="font-semibold text-foreground text-sm mb-1">Pro Feature</p>
                        <p className="text-xs text-muted-foreground mb-3">Access data products with Pro</p>
                        <Button size="sm" variant="secondary" asChild>
                          <a href="/upgrade">Upgrade</a>
                        </Button>
                      </div>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <product.icon className="w-5 h-5 text-primary" />
                          </div>
                          <Badge variant="outline" className="text-xs">{product.price}</Badge>
                        </div>
                        <CardTitle className="text-base">{product.name}</CardTitle>
                        <CardDescription className="text-sm mt-1">{product.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!isFreeTier && (
                      <Button variant="outline" size="sm" className="w-full">
                        View Dashboard
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Coming Soon Features */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
              <CardHeader>
                <CardTitle className="text-xl">Coming Soon</CardTitle>
                <CardDescription>More data products in development</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span className="text-foreground/80">Custom Market Reports</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span className="text-foreground/80">Predictive Analytics Dashboard</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span className="text-foreground/80">API Access for Integration</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Podcast Section */}
        {activeTab === "podcast" && (
          <div className="space-y-6 mb-8">
            <h2 className="text-2xl font-bold">Latest Episodes</h2>
            <div className="space-y-3">
              {podcastEpisodes.map((episode) => (
                <Card key={episode.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="flex gap-4 p-4">
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={episode.image} alt={episode.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <PlayCircle className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-2 line-clamp-2">{episode.title}</h3>
                      <p className="text-sm text-muted-foreground">{episode.duration}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 self-center" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* News Section */}
        {activeTab === "news" && (
          <div className="space-y-6 mb-8">
            <h2 className="text-2xl font-bold">Latest News</h2>
            <div className="space-y-3">
              {newsItems.map((news) => (
                <Card key={news.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="flex gap-4 p-4">
                    <div className="w-28 h-24 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={news.image} alt={news.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-2 line-clamp-2">{news.title}</h3>
                      <p className="text-sm text-muted-foreground">{news.time}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 self-center" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Services Section */}
        {activeTab === "services" && (
          <div className="space-y-6 mb-8">
            <h2 className="text-2xl font-bold">Our Services</h2>
            
            {/* Featured: Exclusive Tech Partnerships */}
            <Card className="border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-background shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-primary text-primary-foreground">Featured</Badge>
                      <Badge variant="outline" className="border-secondary text-secondary">Exclusive Access</Badge>
                    </div>
                    <CardTitle className="text-2xl mb-2">Unlock Enterprise Tech Savings</CardTitle>
                    <CardDescription className="text-base">
                      Get exclusive access to pre-negotiated deals with top auto tech companies. Save thousands while accessing the best tools in the industry.
                    </CardDescription>
                  </div>
                  <div className="hidden sm:block text-4xl">💎</div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-card rounded-lg p-4 border border-border">
                    <div className="text-2xl font-bold text-primary mb-1">30+</div>
                    <div className="text-sm text-muted-foreground">Vetted Partners</div>
                  </div>
                  <div className="bg-card rounded-lg p-4 border border-border">
                    <div className="text-2xl font-bold text-primary mb-1">$50K+</div>
                    <div className="text-sm text-muted-foreground">Avg. Annual Savings</div>
                  </div>
                  <div className="bg-card rounded-lg p-4 border border-border">
                    <div className="text-2xl font-bold text-primary mb-1">Best</div>
                    <div className="text-sm text-muted-foreground">Market Pricing</div>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                    </div>
                    <p className="text-sm"><strong>Pre-Negotiated Enterprise Discounts</strong> - Access pricing typically reserved for large dealer groups</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                    </div>
                    <p className="text-sm"><strong>White-Glove Implementation Support</strong> - Our team guides you through setup and optimization</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                    </div>
                    <p className="text-sm"><strong>Unbiased Tech Stack Reviews</strong> - Get honest recommendations based on your specific needs</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" className="flex-1">
                    Request Consultation
                    <ChevronRight className="h-5 w-5 ml-2" />
                  </Button>
                  <Button variant="outline" size="lg" className="flex-1">
                    View Partner Network
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <Card key={service.id} className="hover:shadow-lg transition-shadow overflow-hidden relative border-2 border-secondary/30">
                  {/* 20% Off Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <Badge className="bg-secondary text-secondary-foreground font-bold px-3 py-1">
                      20% OFF
                    </Badge>
                  </div>
                  
                  <div className="flex flex-col items-center text-center p-6 gap-4">
                    <div className={`${service.color} w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0`}>
                      <service.icon className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-2">{service.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{service.description}</p>
                      <p className="text-xs font-semibold text-secondary">
                        🎉 CDG Circles Member Exclusive
                      </p>
                    </div>
                    <Button variant="default" size="sm" className="w-full mt-2">
                      Claim Discount
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* CDG One Section */}
        {activeTab === "cdg-one" && (
          <div className="space-y-6 mb-8">
            <h2 className="text-2xl font-bold lg:hidden">CDG One</h2>
            <CDGOneBenefits />
          </div>
        )}

        {/* Learning & Development Section */}
        {activeTab === "learning" && (
          <div className="space-y-6 mb-8">
            <h2 className="text-2xl font-bold lg:hidden">Learning & Development</h2>
            
            {/* Coming Soon Notice */}
            <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-8 h-8 text-primary" />
                  <div>
                    <CardTitle>Learning Management System Coming Soon</CardTitle>
                    <CardDescription className="mt-1">
                      Access comprehensive training, certifications, and professional development resources
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div className="bg-card rounded-lg p-4 border border-border">
                    <BookOpen className="w-6 h-6 text-primary mb-2" />
                    <h4 className="font-semibold mb-1 text-sm">Course Library</h4>
                    <p className="text-xs text-muted-foreground">Expert-led courses on sales, F&I, marketing, and operations</p>
                  </div>
                  <div className="bg-card rounded-lg p-4 border border-border">
                    <Target className="w-6 h-6 text-primary mb-2" />
                    <h4 className="font-semibold mb-1 text-sm">Certifications</h4>
                    <p className="text-xs text-muted-foreground">Industry-recognized credentials for your team</p>
                  </div>
                  <div className="bg-card rounded-lg p-4 border border-border">
                    <TrendingUp className="w-6 h-6 text-primary mb-2" />
                    <h4 className="font-semibold mb-1 text-sm">Track Progress</h4>
                    <p className="text-xs text-muted-foreground">Monitor team development and skill advancement</p>
                  </div>
                </div>
                <Button variant="secondary">
                  Get Notified at Launch
                  <Bell className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Preview Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="hover:shadow-lg transition-shadow border-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    Sales Excellence
                  </CardTitle>
                  <CardDescription className="text-xs">Master modern selling techniques</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow border-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                    </div>
                    F&I Mastery
                  </CardTitle>
                  <CardDescription className="text-xs">Advanced finance strategies</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow border-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Target className="w-4 h-4 text-green-500" />
                    </div>
                    Leadership Development
                  </CardTitle>
                  <CardDescription className="text-xs">Build high-performing teams</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Events Section */}
        {activeTab === "events" && (
          <div className="space-y-6 mb-8">
            <h2 className="text-2xl font-bold lg:hidden">Events</h2>
            
            {/* All Tiers - Free Events */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Open to All Members</h3>
                <Badge variant="outline">Free Tier</Badge>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base mb-1">Monthly Industry Webinar</CardTitle>
                        <CardDescription className="text-xs">Latest trends and insights</CardDescription>
                      </div>
                      <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">Join us for monthly discussions on current market conditions</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Next: Jan 15, 2025</span>
                      <Button size="sm" variant="outline">Register</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base mb-1">Quarterly Town Hall</CardTitle>
                        <CardDescription className="text-xs">Community updates & Q&A</CardDescription>
                      </div>
                      <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">Hear from leadership and network with the community</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Next: Feb 1, 2025</span>
                      <Button size="sm" variant="outline">Register</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Pro Tier Events */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Pro Member Events</h3>
                <Badge>Pro Tier</Badge>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className={`hover:shadow-lg transition-shadow ${isFreeTier ? 'relative overflow-hidden border-2 border-muted' : ''}`}>
                  {isFreeTier && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center z-10">
                      <div className="text-center p-4 bg-card/90 rounded-lg shadow-lg">
                        <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="font-bold text-foreground text-xs">Pro Feature</p>
                        <Button size="sm" variant="secondary" className="mt-2" asChild>
                          <a href="/upgrade">Upgrade</a>
                        </Button>
                      </div>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base mb-1">Monthly Mastermind Sessions</CardTitle>
                        <CardDescription className="text-xs">Small-group strategy discussions</CardDescription>
                      </div>
                      <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">Deep-dive sessions with 8-10 dealers solving real challenges</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Next: Jan 12, 2025</span>
                      {!isFreeTier && <Button size="sm" variant="outline">Register</Button>}
                    </div>
                  </CardContent>
                </Card>

                <Card className={`hover:shadow-lg transition-shadow ${isFreeTier ? 'relative overflow-hidden border-2 border-muted' : ''}`}>
                  {isFreeTier && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center z-10">
                      <div className="text-center p-4 bg-card/90 rounded-lg shadow-lg">
                        <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="font-bold text-foreground text-xs">Pro Feature</p>
                        <Button size="sm" variant="secondary" className="mt-2" asChild>
                          <a href="/upgrade">Upgrade</a>
                        </Button>
                      </div>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base mb-1">Tech Stack Workshop</CardTitle>
                        <CardDescription className="text-xs">Optimize your dealership technology</CardDescription>
                      </div>
                      <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">Learn to maximize ROI from your current tech investments</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Next: Jan 20, 2025</span>
                      {!isFreeTier && <Button size="sm" variant="outline">Register</Button>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Executive Tier Events */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Executive Member Events</h3>
                <Badge variant="default" className="bg-gradient-to-r from-primary to-secondary">Executive Tier</Badge>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className={`hover:shadow-lg transition-shadow border-2 ${isExecutiveTier ? 'border-primary/30' : 'border-muted'} ${!isExecutiveTier ? 'relative overflow-hidden' : ''}`}>
                  {!isExecutiveTier && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center z-10">
                      <div className="text-center p-4 bg-card/90 rounded-lg shadow-lg">
                        <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="font-bold text-foreground text-xs">Executive Feature</p>
                        <Button size="sm" variant="default" className="mt-2" asChild>
                          <a href="/#pricing">Upgrade</a>
                        </Button>
                      </div>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base mb-1">Annual Executive Summit</CardTitle>
                        <CardDescription className="text-xs">Exclusive in-person gathering</CardDescription>
                      </div>
                      <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">3-day intensive with top dealers, keynotes, and networking</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">March 15-17, 2025</span>
                      {isExecutiveTier && <Button size="sm" variant="outline">Details</Button>}
                    </div>
                  </CardContent>
                </Card>

                <Card className={`hover:shadow-lg transition-shadow border-2 ${isExecutiveTier ? 'border-primary/30' : 'border-muted'} ${!isExecutiveTier ? 'relative overflow-hidden' : ''}`}>
                  {!isExecutiveTier && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center z-10">
                      <div className="text-center p-4 bg-card/90 rounded-lg shadow-lg">
                        <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="font-bold text-foreground text-xs">Executive Feature</p>
                        <Button size="sm" variant="default" className="mt-2" asChild>
                          <a href="/#pricing">Upgrade</a>
                        </Button>
                      </div>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base mb-1">Private Operator Dinners</CardTitle>
                        <CardDescription className="text-xs">Intimate gatherings by region</CardDescription>
                      </div>
                      <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">Connect with 6-8 operators in your market over dinner</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Quarterly</span>
                      {isExecutiveTier && <Button size="sm" variant="outline">RSVP</Button>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Support */}
        <div className="mt-6 text-center pb-4">
          <p className="text-xs text-muted-foreground mb-1">Need help?</p>
          <a 
            href="mailto:circles@cardealershipguy.com" 
            className="text-sm text-primary hover:underline font-medium"
          >
            circles@cardealershipguy.com
          </a>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
