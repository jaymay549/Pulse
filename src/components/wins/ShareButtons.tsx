import { useState } from "react";
import { Linkedin, Link2, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

interface ShareButtonsProps {
  quote: string;
  type: "positive" | "warning" | "insight";
  onDownloadCard?: () => void;
}

const ShareButtons = ({ quote, type, onDownloadCard }: ShareButtonsProps) => {
  const [copied, setCopied] = useState(false);
  
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  
  // Create shareable text (anonymized - no vendor names)
  const getShareText = () => {
    const emoji = type === "positive" ? "✅" : type === "warning" ? "⚠️" : "💡";
    const typeLabel = type === "positive" ? "Win" : type === "warning" ? "Warning" : "Strategy";
    return `${emoji} ${typeLabel} from CDG Circles:\n\n"${quote.slice(0, 200)}${quote.length > 200 ? "..." : ""}"\n\nSee more dealer insights →`;
  };

  const handleTwitterShare = () => {
    const text = encodeURIComponent(getShareText());
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share it with your network",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={handleTwitterShare}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Share on X</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={handleLinkedInShare}
          >
            <Linkedin className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Share on LinkedIn</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={handleCopyLink}
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : "Copy link"}</TooltipContent>
      </Tooltip>

      {onDownloadCard && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={onDownloadCard}
            >
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download as image</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

export default ShareButtons;
