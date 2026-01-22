import { Construction, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import cdgPulseLogo from "@/assets/cdg-pulse-logo.png";

const VendorsUnderConstruction = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <img src={cdgPulseLogo} alt="CDG Pulse" className="h-10 mx-auto mb-6" />
          <Construction className="w-16 h-16 mx-auto text-primary animate-pulse" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Under Construction
        </h1>
        <p className="text-muted-foreground text-lg mb-8">
          We're working on something great! The Vendor Directory will be back soon with exciting updates.
        </p>
        <Button onClick={() => navigate("/")} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Button>
      </div>
    </div>
  );
};

export default VendorsUnderConstruction;
