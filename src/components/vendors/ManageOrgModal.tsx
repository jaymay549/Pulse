import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import VendorOrganizationSettings from "./VendorOrganizationSettings";

interface ManageOrgModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ManageOrgModal({ open, onOpenChange }: ManageOrgModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 bg-transparent shadow-none [&>button]:hidden">
        <div className="relative">
          <VendorOrganizationSettings />
          <DialogClose className="absolute right-4 top-4 z-10 rounded-sm p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
