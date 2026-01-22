import { useState } from "react";
import { Mail, Sparkles, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

interface EmailGateProps {
  onUnlock: () => void;
  totalEntries: number;
}

const emailSchema = z.string().email("Please enter a valid email address");

const EmailGate = ({ onUnlock, totalEntries }: EmailGateProps) => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validate email
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call - in production, you'd send this to your email list
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Store in localStorage to remember
    localStorage.setItem("wins_email_unlocked", "true");
    localStorage.setItem("wins_subscriber_email", email);
    
    setIsUnlocked(true);
    toast({
      title: "You're in! 🎉",
      description: "Enjoy 5 more dealer insights",
    });
    
    setTimeout(() => {
      onUnlock();
    }, 1000);
    
    setIsSubmitting(false);
  };

  return (
    <div className="col-span-full my-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary/20 via-primary/10 to-secondary/20 border-2 border-secondary/30 p-8 sm:p-12">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative max-w-xl mx-auto text-center">
          {!isUnlocked ? (
            <>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 border border-secondary/40 mb-6">
                <Sparkles className="h-4 w-4 text-secondary" />
                <span className="text-sm font-bold text-foreground">Unlock 5 More Insights</span>
              </div>
              
              <h3 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
                Want More Dealer Intel?
              </h3>
              
              <p className="text-muted-foreground mb-6">
                Drop your email to unlock 5 more vendor reviews—free. No spam, just dealer insights.
              </p>
              
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    className={`pl-10 h-12 text-base ${error ? "border-destructive" : ""}`}
                    disabled={isSubmitting}
                  />
                </div>
                <Button 
                  type="submit" 
                  variant="yellow" 
                  size="lg"
                  className="h-12 px-6 font-bold"
                  disabled={isSubmitting || !email}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Unlocking...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Unlock Free
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
              
              {error && (
                <p className="mt-2 text-sm text-destructive">{error}</p>
              )}
              
              <p className="mt-4 text-xs text-muted-foreground">
                We'll also send you the weekly CDG digest. Unsubscribe anytime.
              </p>
            </>
          ) : (
            <div className="py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-2xl font-black text-foreground mb-2">
                You're In! 🎉
              </h3>
              <p className="text-muted-foreground">
                Scroll down to see 5 more dealer insights
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailGate;
