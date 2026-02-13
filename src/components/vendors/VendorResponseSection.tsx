import React, { useState } from "react";
import { ShieldCheck, MessageSquare, Edit2, Trash2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VendorResponse } from "@/hooks/useVendorResponses";
import { useToast } from "@/hooks/use-toast";

interface VendorResponseSectionProps {
  response: VendorResponse | null;
  canRespond: boolean;
  vendorName: string;
  onAddResponse: (text: string) => Promise<boolean>;
  onUpdateResponse: (responseId: string, text: string) => Promise<boolean>;
  onDeleteResponse: (responseId: string) => Promise<boolean>;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const VendorResponseSection: React.FC<VendorResponseSectionProps> = ({
  response,
  canRespond,
  vendorName,
  onAddResponse,
  onUpdateResponse,
  onDeleteResponse,
}) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [responseText, setResponseText] = useState(
    response?.response_text || "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitNew = async () => {
    if (!responseText.trim()) return;
    setIsSubmitting(true);
    const success = await onAddResponse(responseText.trim());
    if (success) {
      toast({ title: "Response posted" });
      setIsAdding(false);
      setResponseText("");
    } else {
      toast({
        title: "Error",
        description: "Failed to post response.",
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  const handleUpdate = async () => {
    if (!response || !responseText.trim()) return;
    setIsSubmitting(true);
    const success = await onUpdateResponse(response.id, responseText.trim());
    if (success) {
      toast({ title: "Response updated" });
      setIsEditing(false);
    } else {
      toast({
        title: "Error",
        description: "Failed to update response.",
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!response) return;
    setIsSubmitting(true);
    const success = await onDeleteResponse(response.id);
    if (success) {
      toast({ title: "Response removed" });
      setResponseText("");
    } else {
      toast({
        title: "Error",
        description: "Failed to delete response.",
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  // --- Display existing response ---
  if (response && !isEditing) {
    return (
      <div className="mt-3 pt-3 border-t border-border/40">
        <div className="flex items-center gap-1.5 mb-1.5">
          <ShieldCheck className="h-3 w-3 text-primary/70" />
          <span className="text-[11px] font-medium text-primary/70 tracking-wide uppercase">
            Vendor Response
          </span>
          <span className="text-[11px] text-muted-foreground/60">
            · {formatDate(response.updated_at)}
          </span>
        </div>
        <p className="text-[13px] text-foreground/75 leading-relaxed">
          {response.response_text}
        </p>
        {canRespond && (
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setResponseText(response.response_text);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Edit2 className="h-2.5 w-2.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-2.5 w-2.5" />
              Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- Edit form ---
  if (isEditing && response) {
    return (
      <div className="mt-3 pt-3 border-t border-border/40 space-y-2.5">
        <Textarea
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          placeholder="Write your response..."
          rows={3}
          className="resize-none text-sm border-border/60 focus-visible:ring-1"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleUpdate}
            disabled={isSubmitting || !responseText.trim()}
            className="h-7 text-xs px-3"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditing(false);
              setResponseText(response.response_text);
            }}
            className="h-7 text-xs px-3 text-muted-foreground"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // --- Add new response (verified vendor only) ---
  if (canRespond && !response) {
    if (isAdding) {
      return (
        <div className="mt-3 pt-3 border-t border-border/40 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-primary/70" />
            <span className="text-xs text-muted-foreground">
              Respond as {vendorName}
            </span>
          </div>
          <Textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Share your perspective..."
            rows={3}
            className="resize-none text-sm border-border/60 focus-visible:ring-1"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSubmitNew}
              disabled={isSubmitting || !responseText.trim()}
              className="h-7 text-xs px-3"
            >
              {isSubmitting ? "Posting..." : "Post"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setResponseText("");
              }}
              className="h-7 text-xs px-3 text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3 pt-3">
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageSquare className="h-3 w-3 opacity-60" />
          Respond to this review
        </button>
      </div>
    );
  }

  return null;
};

export default VendorResponseSection;
