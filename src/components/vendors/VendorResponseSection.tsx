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
  const [responseText, setResponseText] = useState(response?.response_text || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const handleSubmitNew = async () => {
    if (!responseText.trim()) return;
    setIsSubmitting(true);
    
    const success = await onAddResponse(responseText.trim());
    if (success) {
      toast({ title: "Response posted", description: "Your response is now visible." });
      setIsAdding(false);
      setResponseText("");
    } else {
      toast({ title: "Error", description: "Failed to post response.", variant: "destructive" });
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
      toast({ title: "Error", description: "Failed to update response.", variant: "destructive" });
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
      toast({ title: "Error", description: "Failed to delete response.", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  // Existing response display
  if (response && !isEditing) {
    return (
      <div className="mt-4 border-t pt-4">
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified Vendor
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDate(response.updated_at)}
            </span>
          </div>

          {/* Response text */}
          <p className="text-sm text-foreground leading-relaxed">
            {response.response_text}
          </p>

          {/* Edit/Delete buttons for owner */}
          {canRespond && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/10">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => {
                  setIsEditing(true);
                  setResponseText(response.response_text);
                }}
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Editing existing response
  if (isEditing && response) {
    return (
      <div className="mt-4 border-t pt-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Edit your response</span>
          </div>
          <Textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Write your response..."
            rows={3}
            className="resize-none text-sm"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleUpdate}
              disabled={isSubmitting || !responseText.trim()}
              className="text-xs"
            >
              <Send className="h-3 w-3 mr-1" />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setResponseText(response.response_text);
              }}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Add new response (for verified vendor)
  if (canRespond && !response) {
    if (isAdding) {
      return (
        <div className="mt-4 border-t pt-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Respond as {vendorName}
              </span>
            </div>
            <Textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Share your perspective on this feedback..."
              rows={3}
              className="resize-none text-sm"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSubmitNew}
                disabled={isSubmitting || !responseText.trim()}
                className="text-xs"
              >
                <Send className="h-3 w-3 mr-1" />
                {isSubmitting ? "Posting..." : "Post Response"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setResponseText("");
                }}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 border-t pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="text-xs border-primary/30 text-primary hover:bg-primary/5"
        >
          <MessageSquare className="h-3 w-3 mr-1.5" />
          Respond to this review
        </Button>
      </div>
    );
  }

  return null;
};

export default VendorResponseSection;
