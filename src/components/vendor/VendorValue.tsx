import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare } from "lucide-react";

const VendorValue = () => {
  return (
    <section className="py-10 px-6">
      <div className="max-w-md mx-auto space-y-10">
        
        {/* Why This Exists */}
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Why this exists
          </h2>
          <div className="space-y-3 text-foreground/70 leading-relaxed">
            <p>
              Automotive runs on long-lived systems, workflows, and businesses built to last generations.
            </p>
            <p>
              Every year, new vendors enter the industry under very different timelines. They're often building quickly, raising capital, and trying to integrate into a small set of deeply embedded platforms.
            </p>
            <p className="text-foreground font-medium">
              The problem isn't intent. It's context.
            </p>
            <p>
              When vendors don't fully understand how dealerships operate, good ideas stall and promising companies disappear.
            </p>
          </div>
        </div>

        {/* The Vendor Collective */}
        <div className="bg-foreground text-white rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-3">
            The Vendor Collective
          </h3>
          <p className="text-white/80 leading-relaxed mb-4">
            A private peer group for vendors who take the time to learn the industry they're building for.
          </p>
          <p className="text-white/70 text-sm mb-3">Inside, vendors:</p>
          <ul className="space-y-2 text-white/80 text-sm">
            <li>• Learn how dealers evaluate risk, value, and change</li>
            <li>• Get honest, anonymized feedback from real operator conversations</li>
            <li>• Compare notes with other vendors on what works, what breaks, and why</li>
            <li>• Are expected to listen, adapt, and improve</li>
          </ul>
          <p className="text-white/60 text-sm mt-4 italic">
            When it makes sense, insight flows back to dealers. No pitches. No call outs. Just signal.
          </p>
        </div>

        {/* What This Means for Dealers */}
        <div className="bg-white rounded-2xl p-6 border border-border">
          <h3 className="text-lg font-bold text-foreground mb-3">
            What this means for dealers
          </h3>
          <ul className="space-y-2 text-foreground/70 text-sm">
            <li>• Vendors who understand your context before they ever reach out</li>
            <li>• Feedback that influences how products are built, not just how they're sold</li>
            <li>• A clear signal of which vendors are committed to doing this the right way</li>
          </ul>
          <p className="text-foreground/60 text-sm mt-4 italic">
            If a vendor is in the Collective, they've opted into accountability.
          </p>
        </div>

        {/* Built on Slack */}
        <div className="flex items-start gap-4 bg-primary/5 rounded-xl p-5 border border-primary/20">
          <MessageSquare className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground mb-1">Built on Slack</p>
            <p className="text-sm text-foreground/70 leading-relaxed">
              This is a working community. Threads. Long form discussion. Shared context. Not a chat room.
            </p>
          </div>
        </div>

        {/* Membership */}
        <div className="bg-white rounded-2xl p-6 border-2 border-primary/20 shadow-lg text-center">
          <h3 className="text-lg font-bold text-foreground mb-1">Membership</h3>
          <div className="text-4xl font-bold text-foreground mb-1">$299</div>
          <p className="text-foreground/50 text-sm mb-4">per month</p>
          
          <ul className="space-y-1.5 text-foreground/70 text-sm mb-5 text-left">
            <li>• Access to all Slack channels</li>
            <li>• Ongoing industry context and insights</li>
            <li>• Peer learning with other vetted vendors</li>
            <li>• Ongoing accountability</li>
          </ul>
          
          <Button size="lg" variant="yellow" className="w-full shadow-lg" asChild>
            <a href="mailto:circles@cardealershipguy.com?subject=Vendor%20Collective%20Application">
              Apply to Join
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
          <p className="mt-3 text-xs text-foreground/40">
            Application required. Limited membership.
          </p>
        </div>

        {/* Footer Line */}
        <p className="text-sm text-foreground/50 italic text-center">
          If we can help both sides understand each other better, we've done our job.
        </p>
      </div>
    </section>
  );
};

export default VendorValue;
