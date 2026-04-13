import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { vendorSupabase } from "@/integrations/supabase/vendorClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "email" | "otp";

export default function VendorLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Show session-expired banner when redirected from guard: /vendor-login?expired=true
  const isExpired = searchParams.get("expired") === "true";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setSendError(null);
    setIsSending(true);

    try {
      const { error } = await vendorSupabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        const msg = error.message || "";
        if (msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("60 seconds")) {
          setSendError("Too many attempts. Please wait a minute before requesting another code.");
        } else {
          setSendError("This email isn't registered. Contact your sales representative to get access.");
        }
        return;
      }

      toast.success("Code sent! Check your email.");
      setStep("otp");
    } catch (err) {
      console.error("[VendorAuth] sendCode error:", err);
      setSendError("This email isn't registered. Contact your sales representative to get access.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleVerifyCode(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (otp.length < 6) return;

    setOtpError(null);
    setIsVerifying(true);

    try {
      const { data, error } = await vendorSupabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (error) {
        setOtpError("That code is expired or invalid. Request a new code below.");
        return;
      }

      if (data.session) {
        navigate("/vendor-dashboard");
      } else {
        setOtpError("That code is expired or invalid. Request a new code below.");
      }
    } catch (err) {
      console.error("[VendorAuth] verifyCode error:", err);
      setOtpError("That code is expired or invalid. Request a new code below.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleRequestNewCode() {
    setOtp("");
    setOtpError(null);
    setIsSending(true);

    try {
      const { error } = await vendorSupabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        const msg = error.message || "";
        if (msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("60 seconds")) {
          setOtpError("Too many attempts. Please wait a minute before requesting another code.");
        } else {
          setOtpError("This email isn't registered. Contact your sales representative to get access.");
        }
        return;
      }

      toast.success("Code sent! Check your email.");
    } catch (err) {
      console.error("[VendorAuth] requestNewCode error:", err);
      setOtpError("This email isn't registered. Contact your sales representative to get access.");
    } finally {
      setIsSending(false);
    }
  }

  function handleUseDifferentEmail() {
    setStep("email");
    setEmail("");
    setOtp("");
    setSendError(null);
    setOtpError(null);
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
            <CardDescription>Enter your email to receive a one-time code.</CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor-email">Email address</Label>
                  <Input
                    id="vendor-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSending}
                    required
                  />
                  {sendError && (
                    <p role="alert" className="text-destructive text-sm mt-2">
                      {sendError}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" variant="default" disabled={isSending}>
                  {isSending ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" aria-hidden="true" />
                      Sending...
                    </>
                  ) : (
                    "Send Code"
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to {email}. Enter it below.
                </p>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={setOtp}
                    disabled={isVerifying}
                    className="font-mono text-xl font-black"
                  >
                    <InputOTPGroup className={otpError ? "border-destructive" : ""}>
                      <InputOTPSlot index={0} className="h-11" />
                      <InputOTPSlot index={1} className="h-11" />
                      <InputOTPSlot index={2} className="h-11" />
                      <InputOTPSlot index={3} className="h-11" />
                      <InputOTPSlot index={4} className="h-11" />
                      <InputOTPSlot index={5} className="h-11" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {otpError && (
                  <p role="alert" className="text-destructive text-sm mt-2">
                    {otpError}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  variant="default"
                  disabled={isVerifying || otp.length < 6}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" aria-hidden="true" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Code"
                  )}
                </Button>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRequestNewCode}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" aria-hidden="true" />
                        Sending...
                      </>
                    ) : (
                      "Request a new code"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleUseDifferentEmail}
                  >
                    Use a different email
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
