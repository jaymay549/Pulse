import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Mail, Sparkles, ArrowRight } from "lucide-react";
import navLogo from "@/assets/cdg-circles-logo-black.png";

const emailSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
});

// Helper to get onboarding page based on tier
const getOnboardingRedirect = (tier: string): string => {
  switch (tier) {
    case 'executive':
      return '/executive-onboarding';
    case 'pro':
      return '/pro-onboarding';
    case 'viewer':
      return '/viewer-onboarding';
    case 'verified_vendor':
      return '/verified-vendor-onboarding';
    default:
      return '/vendors';
  }
};

const Auth = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Get redirect URL from query params
  const redirectParam = searchParams.get("redirect");
  // If redirect param is set to "onboarding", we'll determine based on tier
  const shouldRedirectToOnboarding = redirectParam === "onboarding";

  useEffect(() => {
    const handleRedirect = async (userId: string) => {
      if (shouldRedirectToOnboarding) {
        // Fetch user's tier from profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('tier')
          .eq('id', userId)
          .single();
        
        const tier = profile?.tier || 'free';
        navigate(getOnboardingRedirect(tier));
      } else {
        navigate(redirectParam || '/vendors');
      }
    };

    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleRedirect(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        handleRedirect(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirectParam, shouldRedirectToOnboarding]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      emailSchema.parse({ email });

      // For onboarding redirects, we need to go through auth first to get tier
      const redirectUrl = shouldRedirectToOnboarding 
        ? `${window.location.origin}/auth?redirect=onboarding`
        : `${window.location.origin}${redirectParam || '/vendors'}`;
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) throw error;

      setMagicLinkSent(true);
      toast({
        title: "Magic link sent!",
        description: "Check your email for a login link.",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "An error occurred",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription className="text-base">
              We sent a magic link to <strong>{email}</strong>. Click the link in the email to sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setMagicLinkSent(false);
                setEmail("");
              }}
            >
              Use a different email
            </Button>
            <div className="text-center">
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
                ← Back to home
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Main Auth Card */}
        <Card className="border-2">
          <CardHeader className="text-center space-y-4">
            <img src={navLogo} alt="CDG Circles" className="h-12 mx-auto" />
            <CardTitle className="text-3xl font-extrabold">
              Sign in to CDG Circles
            </CardTitle>
            <CardDescription className="text-base">
              Enter your email to receive a magic link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 text-base"
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                {loading ? "Sending..." : "Send Magic Link"}
              </Button>
            </form>

            <div className="text-center">
              <a href="/vendors" className="text-sm text-muted-foreground hover:text-foreground">
                ← Back to Vendor Pulse
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Not a Member CTA - Prominent Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FDD835]/20 via-[#FDD835]/10 to-[#FDD835]/20 border-2 border-[#FDD835]/40 p-6 sm:p-8">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FDD835]/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FDD835]/30 rounded-full">
              <Sparkles className="w-4 h-4 text-foreground" />
              <span className="text-sm font-bold text-foreground">Join 2,500+ Dealer Rooftops</span>
            </div>
            
            <h3 className="text-xl sm:text-2xl font-extrabold text-foreground">
              Not a Circles Member?
            </h3>
            
            <p className="text-foreground/70 max-w-sm mx-auto">
              Get access to real vendor reviews, proven strategies, and connect with top dealers nationwide.
            </p>
            
            <Button 
              variant="yellow" 
              size="lg"
              className="w-full sm:w-auto px-8 font-bold shadow-lg hover:shadow-xl transition-all group"
              onClick={() => window.open('https://cdgcircles.com', '_blank')}
            >
              Sign Up Now at CDGCircles.com
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
