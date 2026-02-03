import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Smartphone, Mail, Users, Eye } from "lucide-react";

interface AuthPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhone: () => void;
  onSelectViewer?: () => void;
}

export const AuthPickerModal = ({ isOpen, onClose, onSelectPhone, onSelectViewer }: AuthPickerModalProps) => {
  const handleCirclesMember = () => {
    onClose();
    onSelectPhone();
  };

  const handleViewer = () => {
    onClose();
    // If callback provided, use it (opens modal on same page)
    // Otherwise fall back to navigation (for backwards compatibility)
    if (onSelectViewer) {
      onSelectViewer();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <DialogTitle className="text-xl">How would you like to sign in?</DialogTitle>
          <DialogDescription>
            Choose the option that matches your account type
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          {/* Circles Member Option */}
          <button
            onClick={handleCirclesMember}
            className="flex items-start gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">Circles Member</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Pro / Exec</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in with your phone number
              </p>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Smartphone className="w-3 h-3" />
                <span>WhatsApp verification</span>
              </div>
            </div>
          </button>

          {/* Viewer Option */}
          <button
            onClick={handleViewer}
            className="flex items-start gap-4 p-4 rounded-xl border-2 border-border hover:border-[#FDD835] hover:bg-[#FDD835]/5 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 group-hover:bg-[#FDD835]/20 transition-colors">
              <Eye className="w-6 h-6 text-muted-foreground group-hover:text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">Viewer</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">$299/mo</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                For vendors & partners tracking their brand
              </p>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Mail className="w-3 h-3" />
                <span>Magic link to your inbox</span>
              </div>
            </div>
          </button>
        </div>

        <div className="text-center pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Don't have an account?{" "}
            <a 
              href="https://buy.stripe.com/7sY8wPcPM4qmbOk9qM3oA0u" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Get Viewer Access
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthPickerModal;
