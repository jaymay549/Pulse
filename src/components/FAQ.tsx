import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const FAQ = () => {
  const faqs = [
    {
      question: "How is CDG Circles different from traditional 20 Groups?",
      answer: "Think of it like this: 20 Groups are your quarterly strategy sessions—deep dives that set your long-term vision. CDG Circles is your always-on competitive advantage—real-time intel, strategic insights, and peer collaboration that keeps you sharp in the 90 days between those meetings. Many dealers use both because they serve different needs. Not in a 20 Group? Even better—you get the peer network, structured learning, dealer-only chats, and continuous support without the travel, time commitment, or 90-day wait for answers. One important note: we don't group you only with operators from the same OEM. While there may be some overlap, the focus is on bringing together high-caliber peers from diverse brands and experiences."
    },
    {
      question: "Can I join Circles if I'm not in a 20 Group?",
      answer: "Of course. Circles gives you many of the core benefits—peer network, structured learning, and real-time collaboration—but with a different cadence. Instead of quarterly meetings, you get daily intelligence and instant feedback that helps you adapt faster. It's built for dealers who want peer collaboration without the travel time or 90-day gaps between sessions."
    },
    {
      question: "What size dealerships are in the network?",
      answer: "Our members range from $20M to $500M+ annually, with an average around $112M. We match groups by growth mindset and operational challenges, not just revenue size, so you're learning from peers who face similar real-world problems."
    },
    {
      question: "Are vendors allowed in the groups?",
      answer: "No. We love our vendors, but Circles is dealer-only. That's what makes it safe to speak freely."
    },
    {
      question: "What about antitrust compliance?",
      answer: "CDG Circles complies with all antitrust and competition laws. Participation in CDG Circles constitutes agreement to our antitrust policy. Members must not discuss pricing, market allocation, or competitively sensitive information."
    },
    {
      question: "How is confidentiality protected?",
      answer: "All members commit to a strict confidentiality agreement before joining. What's discussed in Circles stays in Circles. This creates the safe environment dealers need to speak openly about real challenges and share proprietary insights without fear of competitive exposure."
    },
    {
      question: "How much time commitment is required?",
      answer: "Community members can engage at their own pace in the general dealer chat. Pro members get access to focused topic-based chats (Rural, Urban, AI, Fixed Ops, etc.) plus OEM-specific groups. Most Pro members spend about 2-3 hours total per month. Executive members get their own private circle matched by performance, role, and goals—plus access to elite networking and the Executive Retreat."
    },
    {
      question: "What if I don't have time to participate?",
      answer: "Then this probably isn't for you. Circles Pro is for operators who make time for what's important. Each monthly roundtable drives tangible growth through peer collaboration and shared intelligence. If you can't commit to that, we'd recommend starting with Community instead."
    },
    {
      question: "How are groups matched?",
      answer: "It depends on which tier you join.\n\nCommunity gives you access to the general dealer chat—great for open conversation and expanding your network.\n\nPro matches you into focused topic-based chats (Rural, Urban, AI, Fixed Ops, and more) plus OEM-specific groups with dealers who share your franchise.\n\nExecutive gives you a private circle matched by performance, role, and goals—plus access to our elite dealer network where partnerships and deals happen regularly."
    },
    {
      question: "What happens in monthly peer sessions?",
      answer: "Each monthly digital meeting has structure but stays flexible. We cover a key operational topic, run peer hot-seat problem-solving for whoever needs it, check in on goal progress, and share early intel on vendor tools or market shifts. No sales pitches, ever."
    },
    {
      question: "Can I switch groups if it's not a good fit?",
      answer: "In our experience, some of the deepest connections start on rocky terrain. We encourage members to push through—that's when growth happens. But if a change is truly needed, reach out and we'll help you find a better fit."
    },
    {
      question: "When does Circles start?",
      answer: "Applications are due by December 1, 2025. Our inaugural groups and community launch mid-January 2026, with the next group beginning mid-April 2026."
    }
  ];

  return (
    <section className="py-16 sm:py-20 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about CDG Circles membership
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} id={index === 1 ? "not-in-20-group" : undefined}>
                <AccordionItem 
                  value={`item-${index}`}
                  className="border rounded-lg px-6 bg-card"
                >
                  <AccordionTrigger className="text-left font-semibold hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </div>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
