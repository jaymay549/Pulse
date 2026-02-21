import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart2, MessageSquare, TrendingUp } from "lucide-react";

interface VendorDashboardProps {
  vendorName: string;
}

export function VendorDashboard({ vendorName }: VendorDashboardProps) {
  return (
    <div className="mb-8 border rounded-xl bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Badge variant="secondary" className="text-xs">Vendor Dashboard</Badge>
        <span className="text-xs text-muted-foreground">Only visible to you</span>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="mb-5">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-sm">
            <BarChart2 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="respond" className="flex items-center gap-1.5 text-sm">
            <MessageSquare className="h-3.5 w-3.5" />
            Respond
          </TabsTrigger>
          <TabsTrigger value="intel" className="flex items-center gap-1.5 text-sm">
            <TrendingUp className="h-3.5 w-3.5" />
            Market Intel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <p className="text-sm text-muted-foreground">Overview loading…</p>
        </TabsContent>
        <TabsContent value="respond">
          <p className="text-sm text-muted-foreground">Respond tab loading…</p>
        </TabsContent>
        <TabsContent value="intel">
          <p className="text-sm text-muted-foreground">Intel loading…</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
