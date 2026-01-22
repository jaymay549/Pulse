import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, CheckCircle, ArrowRight, Globe, MessageSquare, BarChart3, Bell, Loader2, Clock, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import cdgPulseLogo from "@/assets/cdg-pulse-logo.png";

const VerifiedVendorOnboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State
  const [vendors, setVendors] = useState<string[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [existingProfile, setExistingProfile] = useState<{ vendor_name: string; is_approved: boolean } | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchVendors();
    checkExistingProfile();
  }, []);

  // Fetch unique vendor names from reviews
  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_reviews')
        .select('vendor_name')
        .order('vendor_name');
      
      if (error) throw error;
      
      // Get unique vendor names
      const uniqueVendors = [...new Set(data?.map(r => r.vendor_name) || [])];
      setVendors(uniqueVendors);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user already has a vendor profile
  const checkExistingProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('vendor_profiles')
      .select('vendor_name, is_approved')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setExistingProfile(data);
      setSelectedVendor(data.vendor_name);
    }
  };

  // Submit vendor profile
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVendor) {
      toast({
        title: "Please select your company",
        description: "Choose the vendor you represent from the dropdown.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Not logged in",
          description: "Please sign in to complete your profile.",
          variant: "destructive",
        });
        navigate('/auth?redirect=/verified-vendor-onboarding');
        return;
      }

      const { error } = await supabase
        .from('vendor_profiles')
        .insert({
          user_id: user.id,
          vendor_name: selectedVendor,
          company_website: companyWebsite || null,
          contact_email: contactEmail || user.email,
          is_approved: false,
        });

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          toast({
            title: "Already registered",
            description: "This company already has a verified vendor or you already have a profile.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      setIsSubmitted(true);
      toast({
        title: "Profile submitted!",
        description: "We'll review and approve your account within 24 hours.",
      });
    } catch (err: any) {
      console.error('Failed to submit profile:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to submit profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show pending approval state
  if (existingProfile || isSubmitted) {
    const isApproved = existingProfile?.is_approved;
    
    return (
      <div className="min-h-screen bg-background overflow-hidden relative">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
        </div>

        <header className="relative py-6 px-4 border-b border-border">
          <div className="max-w-4xl mx-auto flex items-center justify-center">
            <img src={cdgPulseLogo} alt="CDG Pulse" className="h-8" />
          </div>
        </header>

        <main className="relative max-w-2xl mx-auto px-4 py-12 sm:py-20">
          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 ${
              isApproved 
                ? 'bg-green-100 border border-green-200' 
                : 'bg-yellow-100 border border-yellow-200'
            }`}>
              {isApproved ? (
                <CheckCircle className="h-10 w-10 text-green-600" />
              ) : (
                <Clock className="h-10 w-10 text-yellow-600" />
              )}
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
              {isApproved ? (
                <>You're <span className="text-green-600">Verified!</span></>
              ) : (
                <>Pending <span className="text-secondary">Approval</span></>
              )}
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto mb-10">
              {isApproved 
                ? `You can now respond to reviews for ${existingProfile?.vendor_name}.`
                : `Your profile for ${existingProfile?.vendor_name || selectedVendor} is being reviewed. We'll notify you within 24 hours.`
              }
            </p>

            {isApproved ? (
              <Button
                size="lg"
                variant="yellow"
                className="font-bold px-10 py-6 text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                onClick={() => navigate("/vendors")}
              >
                View Your Reviews
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            ) : (
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border border-border p-6 text-left max-w-md mx-auto shadow-sm">
                  <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-secondary" />
                    What happens next?
                  </h3>
                  <ul className="text-muted-foreground space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-secondary/20 text-secondary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>Our team will verify your company affiliation</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-secondary/20 text-secondary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>You'll receive an email once approved</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-secondary/20 text-secondary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Then you can respond to dealer reviews</span>
                    </li>
                  </ul>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("/vendors")}
                >
                  Browse Vendor Pulse
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative py-6 px-4 border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <img src={cdgPulseLogo} alt="CDG Pulse" className="h-8" />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-2xl mx-auto px-4 py-12 sm:py-16">
        {/* Success Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-100 border border-green-200 text-green-700 font-medium">
            <CheckCircle className="h-5 w-5" />
            <span>Payment Successful</span>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-secondary/10 border border-secondary/20 mb-6">
            <ShieldCheck className="h-10 w-10 text-secondary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
            Complete Your{" "}
            <span className="text-secondary">
              Profile
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Select the company you represent to get verified and start engaging with dealer feedback.
          </p>
        </div>

        {/* Company Selection Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-card rounded-3xl border border-border p-8 sm:p-10 mb-6 shadow-lg">
            <div className="space-y-6">
              {/* Company Selection */}
              <div className="space-y-2">
                <Label htmlFor="vendor" className="text-base font-medium text-foreground">
                  Which company do you represent? <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                  <SelectTrigger className="h-14 text-base">
                    <SelectValue placeholder={isLoading ? "Loading vendors..." : "Select your company"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor} value={vendor}>
                        {vendor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Don't see your company? Contact us at support@cdgcircles.com
                </p>
              </div>

              {/* Website */}
              <div className="space-y-2">
                <Label htmlFor="website" className="text-base font-medium text-foreground">
                  Company Website
                </Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  className="h-14 text-base"
                />
                <p className="text-xs text-muted-foreground">
                  This will be linked on your company mentions
                </p>
              </div>

              {/* Contact Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium text-foreground">
                  Contact Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="h-14 text-base"
                />
                <p className="text-xs text-muted-foreground">
                  We'll send approval updates here
                </p>
              </div>
            </div>
          </div>

          {/* Benefits Reminder */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-8 shadow-sm">
            <h3 className="font-bold text-foreground mb-4 text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-secondary" />
              Your Verified Vendor Benefits
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="p-2 rounded-lg bg-secondary/10 border border-secondary/20">
                  <Globe className="h-4 w-4 text-secondary" />
                </div>
                <span className="text-sm">Website link on mentions</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="p-2 rounded-lg bg-secondary/10 border border-secondary/20">
                  <MessageSquare className="h-4 w-4 text-secondary" />
                </div>
                <span className="text-sm">Respond to reviews</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="p-2 rounded-lg bg-secondary/10 border border-secondary/20">
                  <Bell className="h-4 w-4 text-secondary" />
                </div>
                <span className="text-sm">Email alerts for new reviews</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="p-2 rounded-lg bg-secondary/10 border border-secondary/20">
                  <BarChart3 className="h-4 w-4 text-secondary" />
                </div>
                <span className="text-sm">Monthly analytics</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            variant="yellow"
            className="w-full font-bold py-6 text-lg shadow-lg hover:shadow-xl transition-all"
            disabled={isSubmitting || !selectedVendor}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit for Approval
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mt-4">
            Approval typically takes less than 24 hours
          </p>
        </form>
      </main>

      {/* Footer */}
      <footer className="relative py-8 px-4 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            Questions? Email us at{" "}
            <a href="mailto:support@cdgcircles.com" className="text-secondary hover:underline">
              support@cdgcircles.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default VerifiedVendorOnboarding;