import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { vendorSupabase } from "@/integrations/supabase/vendorClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function VendorLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get("expired") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data, error: authError } = await vendorSupabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("Invalid email or password. Contact your sales representative if you need help.");
        return;
      }

      if (data.session) {
        navigate("/vendor-dashboard");
      }
    } catch (err) {
      console.error("[VendorAuth] login error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {isExpired && (
          <div
            className="mb-4 w-full max-w-md rounded-lg bg-destructive/10 px-4 py-3 text-destructive text-sm"
            role="alert"
          >
            Your session has expired. Please log in again.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-black tracking-tight">Vendor Portal</CardTitle>
            <CardDescription>Sign in with your vendor credentials.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vendor-email">Email address</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-password">Password</Label>
                <Input
                  id="vendor-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" variant="default" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
