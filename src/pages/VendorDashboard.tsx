import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ShieldCheck, MessageSquare, BarChart3, Globe, 
  ArrowRight, LogOut, Edit2, Save, X, Loader2,
  TrendingUp, Eye, AlertTriangle, ThumbsUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVendorReviews } from "@/hooks/useVendorReviews";
import { useVendorResponses } from "@/hooks/useVendorResponses";
import { VendorLogoUpload } from "@/components/vendor-dashboard/VendorLogoUpload";
import cdgCirclesLogo from "@/assets/cdg-circles-logo-black.png";

interface VendorProfile {
  id: string;
  vendor_name: string;
  company_website: string | null;
  company_logo_url: string | null;
  contact_email: string | null;
  is_approved: boolean;
}

const VendorDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    company_website: "",
    contact_email: "",
  });

  // Fetch vendor reviews
  const { reviews } = useVendorReviews();

  // Filter reviews for this vendor
  const vendorReviews = useMemo(() => {
    if (!profile) return [];
    return reviews.filter(
      (r) => r.vendorName?.toLowerCase() === profile.vendor_name.toLowerCase()
    );
  }, [reviews, profile]);

  const reviewIds = useMemo(() => vendorReviews.map((r) => Number(r.id)), [vendorReviews]);
  const { responses } = useVendorResponses(reviewIds);

  // Analytics
  const analytics = useMemo(() => {
    const positiveCount = vendorReviews.filter((r) => r.type === "positive").length;
    const warningCount = vendorReviews.filter((r) => r.type === "warning").length;
    const responseCount = Object.values(responses).filter(Boolean).length;
    const responseRate = vendorReviews.length > 0 
      ? Math.round((responseCount / vendorReviews.length) * 100) 
      : 0;

    return {
      totalMentions: vendorReviews.length,
      positiveCount,
      warningCount,
      responseCount,
      responseRate,
    };
  }, [vendorReviews, responses]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth?redirect=/vendor-dashboard");
        return;
      }

      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("id, vendor_name, company_website, company_logo_url, contact_email, is_approved")
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        // No vendor profile - redirect to onboarding
        navigate("/verified-vendor-onboarding");
        return;
      }

      setProfile(data);
      setEditForm({
        company_website: data.company_website || "",
        contact_email: data.contact_email || "",
      });
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      toast({
        title: "Error",
        description: "Failed to load your profile.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("vendor_profiles")
        .update({
          company_website: editForm.company_website || null,
          contact_email: editForm.contact_email || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        company_website: editForm.company_website || null,
        contact_email: editForm.contact_email || null,
      });
      setIsEditing(false);
      toast({ title: "Profile updated!" });
    } catch (err) {
      console.error("Failed to update profile:", err);
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/vendors");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  // Pending approval state
  if (!profile.is_approved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
              <ShieldCheck className="h-8 w-8 text-yellow-400" />
            </div>
            <CardTitle className="text-white">Pending Approval</CardTitle>
            <CardDescription className="text-slate-400">
              Your vendor profile for <strong className="text-white">{profile.vendor_name}</strong> is being reviewed. 
              We'll notify you within 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={() => navigate("/vendors")}>
              Browse Vendor Pulse
            </Button>
            <Button variant="ghost" className="w-full text-slate-400" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center">
              <img src={cdgCirclesLogo} alt="CDG Circles" className="h-7" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified Vendor
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Welcome, {profile.vendor_name}
          </h1>
          <p className="text-muted-foreground">
            Manage your company profile and respond to dealer feedback.
          </p>
        </div>

        {/* Analytics Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Total Mentions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{analytics.totalMentions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-green-500" />
                Recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{analytics.positiveCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Warnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{analytics.warningCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Response Rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{analytics.responseRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.responseCount} of {analytics.totalMentions} reviews
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Company Profile */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Company Profile</CardTitle>
                {!isEditing ? (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <VendorLogoUpload
                profileId={profile.id}
                vendorName={profile.vendor_name}
                currentLogoUrl={profile.company_logo_url}
                onLogoUpdated={(url) => setProfile({ ...profile, company_logo_url: url })}
              />

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Company Name</Label>
                  <p className="font-medium">{profile.vendor_name}</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Website
                  </Label>
                  {isEditing ? (
                    <Input
                      type="url"
                      placeholder="https://yourcompany.com"
                      value={editForm.company_website}
                      onChange={(e) => setEditForm({ ...editForm, company_website: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium">
                      {profile.company_website ? (
                        <a 
                          href={profile.company_website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {profile.company_website}
                        </a>
                      ) : (
                        <span className="text-muted-foreground italic">Not set</span>
                      )}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    This link appears on your review cards
                  </p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Contact Email</Label>
                  {isEditing ? (
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      value={editForm.contact_email}
                      onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium">
                      {profile.contact_email || <span className="text-muted-foreground italic">Not set</span>}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for review notifications
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Reviews */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Your Reviews</CardTitle>
                <Button variant="outline" size="sm" onClick={() => navigate("/vendors")}>
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              <CardDescription>
                Recent dealer feedback about {profile.vendor_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {vendorReviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No reviews yet for your company.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {vendorReviews.slice(0, 5).map((review) => {
                    const hasResponse = responses[Number(review.id)] !== null;
                    return (
                      <div 
                        key={review.id} 
                        className={`p-4 rounded-lg border ${
                          review.type === "positive" 
                            ? "border-l-4 border-l-green-500 bg-green-50/50" 
                            : "border-l-4 border-l-red-500 bg-red-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold uppercase ${
                                review.type === "positive" ? "text-green-700" : "text-red-700"
                              }`}>
                                {review.type === "positive" ? "Recommended" : "Warning"}
                              </span>
                              {hasResponse && (
                                <span className="text-xs text-primary font-medium flex items-center gap-1">
                                  <ShieldCheck className="h-3 w-3" />
                                  Responded
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-foreground line-clamp-2">{review.quote}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="shrink-0"
                            onClick={() => navigate(`/vendors?search=${encodeURIComponent(profile.vendor_name)}`)}
                          >
                            {hasResponse ? "View" : "Respond"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 p-6 rounded-xl bg-muted/50 border">
          <h3 className="font-bold text-foreground mb-4">Quick Actions</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="justify-start h-auto py-4"
              onClick={() => navigate(`/vendors?search=${encodeURIComponent(profile.vendor_name)}`)}
            >
              <MessageSquare className="h-5 w-5 mr-3 text-primary" />
              <div className="text-left">
                <div className="font-medium">Respond to Reviews</div>
                <div className="text-xs text-muted-foreground">Engage with dealer feedback</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-auto py-4"
              onClick={() => setIsEditing(true)}
            >
              <Globe className="h-5 w-5 mr-3 text-primary" />
              <div className="text-left">
                <div className="font-medium">Update Website</div>
                <div className="text-xs text-muted-foreground">Link on your mentions</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-auto py-4"
              onClick={() => navigate("/vendors")}
            >
              <BarChart3 className="h-5 w-5 mr-3 text-primary" />
              <div className="text-left">
                <div className="font-medium">Browse All Reviews</div>
                <div className="text-xs text-muted-foreground">See what dealers are saying</div>
              </div>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VendorDashboard;
