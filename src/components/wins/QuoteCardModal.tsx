import { useRef, useState } from "react";
import { Download, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import cdgLogo from "@/assets/cdg-circles-logo-white.png";
import { parseMarkdown } from "@/utils/markdown";

interface QuoteCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: string;
  title: string;
  type: "positive" | "warning" | "insight";
  vendorName?: string;
  vendorLogo?: string | null;
}

const QuoteCardModal = ({ isOpen, onClose, quote, type, vendorName, vendorLogo }: QuoteCardModalProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const getTypeConfig = () => {
    switch (type) {
      case "positive":
        return {
          emoji: "✅",
          label: "WIN",
          gradient: "from-green-600 via-green-700 to-green-800",
          accent: "bg-green-400",
        };
      case "warning":
        return {
          emoji: "⚠️",
          label: "WARNING",
          gradient: "from-red-600 via-red-700 to-red-800",
          accent: "bg-red-400",
        };
      default:
        return {
          emoji: "💡",
          label: "STRATEGY",
          gradient: "from-blue-600 via-blue-700 to-blue-800",
          accent: "bg-blue-400",
        };
    }
  };

  const config = getTypeConfig();
  
  // Truncate quote for card
  const displayQuote = quote.length > 280 ? quote.slice(0, 280) + "..." : quote;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    setIsDownloading(true);
    
    try {
      // Dynamic import html2canvas
      const html2canvas = (await import("html2canvas")).default;
      
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      
      const link = document.createElement("a");
      link.download = `cdg-circles-${type}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      
      toast({
        title: "Image downloaded!",
        description: "Share it on social media",
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
    
    setIsDownloading(false);
  };

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleTwitterShare = () => {
    const text = encodeURIComponent(`${config.emoji} ${config.label} from CDG Circles:\n\n"${displayQuote.slice(0, 150)}..."\n\nSee more dealer insights →`);
    const url = encodeURIComponent(pageUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "width=550,height=420"
    );
  };

  const handleLinkedInShare = () => {
    const url = encodeURIComponent(pageUrl);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      "_blank",
      "width=550,height=420"
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Share This Insight</span>
          </DialogTitle>
        </DialogHeader>
        
        {/* Preview Card */}
        <div className="relative">
          <div
            ref={cardRef}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} p-8 aspect-square max-w-md mx-auto`}
          >
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            {/* Content */}
            <div className="relative h-full flex flex-col justify-between">
              {/* Badge */}
              <div className="flex items-center gap-2">
                <span className="text-2xl">{config.emoji}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-black text-white/90 ${config.accent}/30 bg-white/10 border border-white/20`}>
                  {config.label}
                </span>
              </div>
              
              {/* Vendor Logo and Name */}
              {vendorName && (
                <div className="flex items-center gap-3 mt-4">
                  <Avatar className="h-10 w-10 border-2 border-white/20 shrink-0">
                    <AvatarImage src={vendorLogo || undefined} alt={vendorName} />
                    <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                      {vendorName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-sm font-semibold truncate">
                      {vendorName}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Quote */}
              <div className="flex-1 flex items-center py-6">
                <p className="text-white text-lg sm:text-xl font-medium leading-relaxed">
                  "{parseMarkdown(displayQuote)}"
                </p>
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={cdgLogo} alt="CDG Circles" className="h-6" />
                </div>
                <p className="text-white/60 text-xs font-medium">
                  cdgcircles.com
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Button
            variant="outline"
            onClick={handleTwitterShare}
            className="gap-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </Button>
          <Button
            variant="outline"
            onClick={handleLinkedInShare}
            className="gap-2"
          >
            <Linkedin className="h-4 w-4" />
            Share on LinkedIn
          </Button>
          <Button
            variant="yellow"
            onClick={handleDownload}
            disabled={isDownloading}
            className="gap-2"
          >
            {isDownloading ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download Image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteCardModal;
