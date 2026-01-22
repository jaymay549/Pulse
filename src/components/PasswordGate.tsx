import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

interface PasswordGateProps {
  children: React.ReactNode;
  correctPassword?: string;
  sessionKey?: string;
}

export const PasswordGate = ({ 
  children, 
  correctPassword = "cdgpulse2026",
  sessionKey = "pulse_unlocked"
}: PasswordGateProps) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if already unlocked in this session
    const unlocked = sessionStorage.getItem(sessionKey);
    if (unlocked === "true") {
      setIsUnlocked(true);
    }
  }, [sessionKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === correctPassword) {
      setIsUnlocked(true);
      sessionStorage.setItem(sessionKey, "true");
      setError("");
    } else {
      setError("Incorrect password");
      setPassword("");
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Lock className="h-12 w-12 text-primary" />
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-foreground">Protected Page</h2>
          <p className="mt-2 text-muted-foreground">
            Enter password to access CDG Pulse
          </p>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="text-center"
            autoFocus
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" size="lg">
            Unlock
          </Button>
        </form>
      </div>
    </div>
  );
};
