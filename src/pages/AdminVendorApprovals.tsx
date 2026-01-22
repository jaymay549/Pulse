import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ShieldCheck,
  ShieldX,
  Loader2,
  Globe,
  Mail,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Building2,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import cdgCirclesLogo from "@/assets/cdg-circles-logo-black.png";

interface VendorProfile {
  id: string;
  user_id: string;
  vendor_name: string;
  company_website: string | null;
  company_logo_url: string | null;
  contact_email: string | null;
  company_description: string | null;
  is_approved: boolean;
  created_at: string;
}

const AdminVendorApprovals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingProfiles, setPendingProfiles] = useState<VendorProfile[]>([]);
  const [approvedProfiles, setApprovedProfiles] = useState<VendorProfile[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth?redirect=/admin/vendor-approvals");
        return;
      }

      // Check if user is admin
      const { data: isAdminRole } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (!isAdminRole) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to view this page.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await fetchProfiles();
    } catch (err) {
      console.error("Failed to check admin status:", err);
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const pending = (data || []).filter((p) => !p.is_approved);
      const approved = (data || []).filter((p) => p.is_approved);

      setPendingProfiles(pending);
      setApprovedProfiles(approved);
    } catch (err) {
      console.error("Failed to fetch profiles:", err);
      toast({
        title: "Error",
        description: "Failed to load vendor profiles.",
        variant: "destructive",
      });
    }
  };

  const handleApprove = async (profile: VendorProfile) => {
    setProcessingId(profile.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("vendor_profiles")
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq("id", profile.id);

      if (error) throw error;

      // Move from pending to approved
      setPendingProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      setApprovedProfiles((prev) => [{ ...profile, is_approved: true }, ...prev]);

      toast({
        title: "Vendor Approved",
        description: `${profile.vendor_name} is now a verified vendor.`,
      });
    } catch (err) {
      console.error("Failed to approve vendor:", err);
      toast({
        title: "Error",
        description: "Failed to approve vendor.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (profile: VendorProfile) => {
    setProcessingId(profile.id);
    try {
      const { error } = await supabase
        .from("vendor_profiles")
        .delete()
        .eq("id", profile.id);

      if (error) throw error;

      setPendingProfiles((prev) => prev.filter((p) => p.id !== profile.id));

      toast({
        title: "Application Rejected",
        description: `${profile.vendor_name}'s application has been removed.`,
      });
    } catch (err) {
      console.error("Failed to reject vendor:", err);
      toast({
        title: "Error",
        description: "Failed to reject application.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevoke = async (profile: VendorProfile) => {
    setProcessingId(profile.id);
    try {
      const { error } = await supabase
        .from("vendor_profiles")
        .update({
          is_approved: false,
          approved_at: null,
          approved_by: null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      // Move from approved to pending
      setApprovedProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      setPendingProfiles((prev) => [{ ...profile, is_approved: false }, ...prev]);

      toast({
        title: "Verification Revoked",
        description: `${profile.vendor_name} is no longer verified.`,
      });
    } catch (err) {
      console.error("Failed to revoke verification:", err);
      toast({
        title: "Error",
        description: "Failed to revoke verification.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const displayedProfiles = activeTab === "pending" ? pendingProfiles : approvedProfiles;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center">
              <img src={cdgCirclesLogo} alt="CDG Circles" className="h-7" />
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Vendor Approvals
          </h1>
          <p className="text-muted-foreground">
            Review and manage verified vendor applications.
          </p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingProfiles.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Approvals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvedProfiles.length}</p>
                  <p className="text-sm text-muted-foreground">Verified Vendors</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "pending" ? "default" : "outline"}
            onClick={() => setActiveTab("pending")}
          >
            Pending
            {pendingProfiles.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingProfiles.length}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeTab === "approved" ? "default" : "outline"}
            onClick={() => setActiveTab("approved")}
          >
            Approved
          </Button>
        </div>

        {/* Profiles List */}
        {displayedProfiles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                {activeTab === "pending" ? (
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <Users className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <p className="text-muted-foreground">
                {activeTab === "pending"
                  ? "No pending applications"
                  : "No verified vendors yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {displayedProfiles.map((profile) => (
              <Card key={profile.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Avatar */}
                    <Avatar className="h-16 w-16 border-2 border-border shrink-0">
                      <AvatarImage src={profile.company_logo_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                        {getInitials(profile.vendor_name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">
                            {profile.vendor_name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                            {profile.contact_email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3.5 w-3.5" />
                                {profile.contact_email}
                              </span>
                            )}
                            {profile.company_website && (
                              <a
                                href={profile.company_website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:underline"
                              >
                                <Globe className="h-3.5 w-3.5" />
                                Website
                              </a>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Applied {formatDate(profile.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {profile.is_approved && (
                          <Badge className="bg-green-100 text-green-700 shrink-0">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>

                      {profile.company_description && (
                        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                          {profile.company_description}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-4">
                        {!profile.is_approved ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(profile)}
                              disabled={processingId === profile.id}
                            >
                              {processingId === profile.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(profile)}
                              disabled={processingId === profile.id}
                            >
                              {processingId === profile.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <XCircle className="h-4 w-4 mr-1" />
                              )}
                              Reject
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRevoke(profile)}
                            disabled={processingId === profile.id}
                          >
                            {processingId === profile.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <ShieldX className="h-4 w-4 mr-1" />
                            )}
                            Revoke Verification
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminVendorApprovals;
