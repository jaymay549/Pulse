import React, { useState, useEffect, useRef } from "react";
import {
    MessageCircle, ShieldCheck, X, AlertCircle, Loader2
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@/components/ui/input-otp";
import cdgCirclesLogo from "@/assets/cdg-circles-logo-black.png";

// WhatsApp icon SVG component
const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
);

interface WamAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRequestCode: (phone: string) => Promise<any>;
    onVerifyCode: (phone: string, code: string) => Promise<any>;
}

const WamAuthModal = ({ isOpen, onClose, onRequestCode, onVerifyCode }: WamAuthModalProps) => {
    const [step, setStep] = useState<"phone" | "code">("phone");
    const [phoneNumber, setPhoneNumber] = useState<string | undefined>(undefined);
    const [code, setCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resendTimer, setResendTimer] = useState(0);
    const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
    const phoneInputRef = useRef<HTMLInputElement>(null);
    const codeInputRef = useRef<React.ElementRef<typeof InputOTP>>(null);

    // Auto-focus phone input on mount
    useEffect(() => {
        if (step === "phone" && phoneInputRef.current && isOpen) {
            phoneInputRef.current.focus();
        }
    }, [step, isOpen]);

    // Auto-focus code input when code step loads
    useEffect(() => {
        if (step === "code" && codeInputRef.current && isOpen) {
            setTimeout(() => {
                codeInputRef.current?.focus();
            }, 100);
        }
    }, [step, isOpen]);

    // Resend timer countdown
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    // Reset code when step changes to code
    useEffect(() => {
        if (step === "code") {
            setCode("");
        }
    }, [step]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setStep("phone");
            setPhoneNumber(undefined);
            setCode("");
            setError(null);
            setResendTimer(0);
            setShowNotRegisteredModal(false);
        }
    }, [isOpen]);

    const handleRequestCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneNumber) return;

        setIsLoading(true);
        setError(null);
        try {
            const result = await onRequestCode(phoneNumber);
            if (result.success) {
                setStep("code");
                setResendTimer(60); // 1 minute
            } else {
                if (result.code === "USER_NOT_REGISTERED") {
                    setIsLoading(false);
                    setShowNotRegisteredModal(true);
                    return;
                }
                setError(result.error || "Failed to send code");
            }
        } catch (err: any) {
            // Handle 429 rate limit error - show code entry screen with countdown
            if (err.status === 429 || err.error?.code === "RATE_LIMIT_EXCEEDED") {
                setStep("code");
                setResendTimer(60); // 1 minute countdown
                setIsLoading(false);
                return;
            }

            if (err.error?.code === "USER_NOT_REGISTERED") {
                setIsLoading(false);
                setShowNotRegisteredModal(true);
                return;
            }

            // Extract error message properly
            let errorMessage = "Failed to send code";
            if (typeof err.error === "string") {
                errorMessage = err.error;
            } else if (err.error?.error) {
                errorMessage = err.error.error;
            } else if (err.message) {
                errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCodeChange = (value: string) => {
        setCode(value);
        // Auto-submit if all 6 digits entered
        if (value.length === 6) {
            handleVerifyCode(value);
        }
    };

    const handleVerifyCode = async (codeValue?: string) => {
        const codeToVerify = codeValue || code;
        if (codeToVerify.length !== 6) {
            setError("Please enter the 6-digit code");
            return;
        }

        if (!phoneNumber) {
            setError("Phone number is required");
            return;
        }

        setError(null);
        setIsLoading(true);

        try {
            const result = await onVerifyCode(phoneNumber, codeToVerify);
            if (result.success) {
                onClose();
                // Reset state for next time
                setStep("phone");
                setPhoneNumber(undefined);
                setCode("");
            } else {
                setError(result.error || "Invalid code");
                setCode("");
            }
        } catch (err: any) {
            // Extract error message properly
            let errorMessage = "Invalid code";
            if (typeof err.error === "string") {
                errorMessage = err.error;
            } else if (err.error?.error) {
                errorMessage = err.error.error;
            } else if (err.message) {
                errorMessage = err.message;
            }
            setError(errorMessage);
            setCode("");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (resendTimer > 0) return;

        if (!phoneNumber) {
            setError("Phone number is required");
            return;
        }

        setError(null);
        setIsLoading(true);

        try {
            const result = await onRequestCode(phoneNumber);
            if (result.success) {
                setResendTimer(60); // Reset timer (1 minute)
                setCode("");
            } else {
                if (result.code === "USER_NOT_REGISTERED") {
                    setShowNotRegisteredModal(true);
                    return;
                }
                setError(result.error || "Failed to resend code");
            }
        } catch (err: any) {
            // Handle 429 rate limit error - reset countdown timer
            if (err.status === 429 || err.error?.code === "RATE_LIMIT_EXCEEDED") {
                setResendTimer(60); // Reset timer (1 minute)
                setIsLoading(false);
                return;
            }

            if (err.error?.code === "USER_NOT_REGISTERED") {
                setShowNotRegisteredModal(true);
                return;
            }

            // Extract error message properly
            let errorMessage = "Failed to resend code";
            if (typeof err.error === "string") {
                errorMessage = err.error;
            } else if (err.error?.error) {
                errorMessage = err.error.error;
            } else if (err.message) {
                errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const formatResendTimer = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-md rounded-2xl bg-white border border-border shadow-2xl overflow-hidden p-0 gap-0">
                    <div className="p-8">
                        <DialogHeader className="space-y-4">
                            <div className="mx-auto mb-2">
                                <img
                                    src={cdgCirclesLogo}
                                    alt="CDG Circles"
                                    className="h-8 mx-auto"
                                />
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-2xl font-bold text-center text-foreground tracking-tight">
                                    Sign In
                                </DialogTitle>
                                {step === "code" && (
                                    <DialogDescription className="text-center text-muted-foreground text-sm">
                                        Code sent to {phoneNumber}
                                    </DialogDescription>
                                )}
                            </div>
                        </DialogHeader>

                        <div className="mt-8">
                            {error && (
                                <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3 text-red-600 text-sm">
                                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                    <p className="leading-relaxed">{error}</p>
                                </div>
                            )}

                            {step === "phone" ? (
                                <form onSubmit={handleRequestCode} className="space-y-6">
                                    <div className="space-y-3">
                                        <Label htmlFor="tel" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                            Phone Number
                                        </Label>
                                        <PhoneInput
                                            ref={phoneInputRef}
                                            id="tel"
                                            name="tel"
                                            value={phoneNumber}
                                            onChange={setPhoneNumber}
                                            disabled={isLoading}
                                            placeholder="(555) 123-4567"
                                            className="h-14 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20 text-lg px-4"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        variant="yellow"
                                        className="w-full h-14 font-bold text-base shadow-lg shadow-yellow-500/10 active:scale-[0.98] transition-all"
                                        disabled={isLoading || !phoneNumber}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <WhatsAppIcon className="h-6 w-6 mr-2" />
                                                Send Verification Code
                                            </>
                                        )}
                                    </Button>
                                </form>
                            ) : (
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1 block text-center">
                                            Verification Code
                                        </Label>
                                        <div className="flex justify-center">
                                            <InputOTP
                                                ref={codeInputRef}
                                                maxLength={6}
                                                value={code}
                                                onChange={handleCodeChange}
                                                disabled={isLoading}
                                                containerClassName="gap-3"
                                            >
                                                <InputOTPGroup className="gap-2">
                                                    <InputOTPSlot
                                                        index={0}
                                                        className="w-12 h-16 text-2xl font-bold bg-background border-border text-foreground focus:border-primary focus:ring-primary/20 rounded-lg"
                                                    />
                                                    <InputOTPSlot
                                                        index={1}
                                                        className="w-12 h-16 text-2xl font-bold bg-background border-border text-foreground focus:border-primary focus:ring-primary/20 rounded-lg"
                                                    />
                                                    <InputOTPSlot
                                                        index={2}
                                                        className="w-12 h-16 text-2xl font-bold bg-background border-border text-foreground focus:border-primary focus:ring-primary/20 rounded-lg"
                                                    />
                                                </InputOTPGroup>
                                                <InputOTPSeparator className="text-muted-foreground/50 mx-1" />
                                                <InputOTPGroup className="gap-2">
                                                    <InputOTPSlot
                                                        index={3}
                                                        className="w-12 h-16 text-2xl font-bold bg-background border-border text-foreground focus:border-primary focus:ring-primary/20 rounded-lg"
                                                    />
                                                    <InputOTPSlot
                                                        index={4}
                                                        className="w-12 h-16 text-2xl font-bold bg-background border-border text-foreground focus:border-primary focus:ring-primary/20 rounded-lg"
                                                    />
                                                    <InputOTPSlot
                                                        index={5}
                                                        className="w-12 h-16 text-2xl font-bold bg-background border-border text-foreground focus:border-primary focus:ring-primary/20 rounded-lg"
                                                    />
                                                </InputOTPGroup>
                                            </InputOTP>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Button
                                            onClick={() => handleVerifyCode()}
                                            variant="yellow"
                                            className="w-full h-14 font-bold text-base shadow-lg shadow-yellow-500/10 active:scale-[0.98] transition-all"
                                            disabled={isLoading || code.length !== 6}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                                    Verifying...
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldCheck className="h-5 w-5 mr-2" />
                                                    Verify & Unlock
                                                </>
                                            )}
                                        </Button>

                                        <div className="flex flex-col gap-3">
                                            <button
                                                type="button"
                                                onClick={handleResendCode}
                                                disabled={resendTimer > 0 || isLoading}
                                                className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                                            >
                                                {resendTimer > 0
                                                    ? `Resend code in ${formatResendTimer(resendTimer)}`
                                                    : "Resend code"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setStep("phone");
                                                    setCode("");
                                                    setError("");
                                                }}
                                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                Change phone number
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-muted/50 border-t border-border p-6">
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
                                <span className="w-6 h-px bg-border" />
                                Secure Verification
                                <span className="w-6 h-px bg-border" />
                            </div>
                            <p className="text-[11px] text-center text-muted-foreground leading-relaxed max-w-[280px]">
                                Verified dealer identity via WhatsApp. Full intel access for registered members only.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Not Registered Modal */}
            <Dialog
                open={showNotRegisteredModal}
                onOpenChange={setShowNotRegisteredModal}
            >
                <DialogContent
                    className="bg-white border border-border max-w-md p-0 gap-0 shadow-2xl rounded-2xl overflow-hidden"
                >
                    <div className="p-8 pb-6">
                        <DialogHeader className="text-left space-y-4">
                            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center border border-border">
                                <AlertCircle className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-foreground text-2xl font-bold tracking-tight">
                                    Account Not Found
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                                    We couldn't find an account associated with this phone number.
                                    Sign up for CDG Circles to access Dealer Pulse and stay
                                    connected with your dealer community.
                                </DialogDescription>
                            </div>
                        </DialogHeader>
                    </div>
                    <DialogFooter className="p-6 pt-0 flex flex-col sm:flex-row gap-3 border-t border-border bg-muted/30">
                        <Button
                            variant="ghost"
                            onClick={() => setShowNotRegisteredModal(false)}
                            className="w-full sm:w-auto order-2 sm:order-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="yellow"
                            onClick={() => {
                                window.location.href = "https://cdgcircles.com/#pricing";
                            }}
                            className="w-full sm:w-auto order-1 sm:order-2 font-bold shadow-lg shadow-yellow-500/10 active:scale-[0.98] transition-all"
                        >
                            Sign Up for CDG Circles
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default WamAuthModal;
