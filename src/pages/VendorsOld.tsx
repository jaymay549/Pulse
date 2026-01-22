import React, { useState, useEffect, useRef, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { 
  Quote, Lock, ThumbsUp, AlertTriangle, Search, Filter, 
  ChevronDown, Share2, Check, Lightbulb, X, Crown, User, LogOut, ArrowUp,
  MessageCircle, Zap, ShieldCheck, Info, ChevronLeft, ChevronRight
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import cdgCirclesLogo from "@/assets/cdg-circles-logo-black.png";

import ShareButtons from "@/components/wins/ShareButtons";

import QuoteCardModal from "@/components/wins/QuoteCardModal";
import UpgradeModal from "@/components/UpgradeModal";


import { useReferralTracking } from "@/hooks/useReferralTracking";
import { useTrendingEntries } from "@/hooks/useTrendingEntries";
import { useAirtableReviews, getAccessLevel } from "@/hooks/useAirtableReviews";
import { useVendorReviews, VendorEntry } from "@/hooks/useVendorReviews";
import { supabase } from "@/integrations/supabase/client";

const categories = [
  { id: "all", label: "All", icon: "🔥" },
  { id: "dms-crm", label: "DMS & CRM", icon: "💻" },
  { id: "digital-retailing", label: "Digital Retailing", icon: "🛒" },
  { id: "marketing", label: "Marketing & Ads", icon: "📣" },
  { id: "fixed-ops", label: "Fixed Ops", icon: "🔧" },
  { id: "equity-mining", label: "Equity Mining", icon: "💎" },
  { id: "recon", label: "Reconditioning", icon: "🚗" },
  { id: "ai-automation", label: "AI & Automation", icon: "🤖" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "training", label: "Training", icon: "🎓" },
  { id: "accounting", label: "Accounting", icon: "📊" },
  { id: "hr-payroll", label: "HR & Payroll", icon: "👥" },
  { id: "service-products", label: "Service Products", icon: "🧴" },
  { id: "diagnostics", label: "Diagnostics", icon: "🔍" },
  { id: "security", label: "Security & Tracking", icon: "🔐" },
  { id: "lead-providers", label: "Lead Providers", icon: "📞" },
  { id: "call-management", label: "Call Management", icon: "📱" },
  { id: "it-support", label: "IT Support", icon: "🖥️" },
];

// List of all vendor names to blur
const vendorNamesToBlur = [
  // DMS & CRM
  "Tekion", "CDK", "CDK Service", "CDK Global", "CDK Drive", "CDK SimplePay",
  "DriveCentric", "Drive Centric", "Drive centric",
  "VinSolutions", "Vin Solutions", "Vin", "Auto/mate", "Automate", "Dealersocket", 
  "DealerSocket", "Dealer Socket", "Reynolds", "Reynolds and Reynolds", "Autosoft",
  "Proton", "Client Command", "Foundation Direct", "Foundation", "PBS",
  "Reverse Risk", "DealerTrack", "Dealer Track", "Eleads", "eLeads", "Solera",
  "QoreAI", "Qore", "RMI",
  
  // Digital Retailing
  "Gubagoo", "Podium", "Autofi", "AutoFi", "Trade Pending", "TradePending",
  "CarNow", "Roadster", "Monogram", "SmartPath", "Smartpath", "UpdatePromise",
  
  // Marketing
  "Pure Cars", "PureCars", "Purecars", "Force Marketing", "Clarivoy", "Capital One", "Cap One",
  "Mudd", "Mudd mailers", "Cedar Marketing", "Go High Level", "GoHighLevel", 
  "gohighlevel", "driveai", "automotiveaccelerator", "Epsilon", "Strategic",
  "Willowood", "Willowood Ventures", "Adperance", "Catalyst", "SMedia", "Smedia",
  "Dealer Inspire", "DI", "Dealer.com", "Team Velocity", "Team V", "OverFuel",
  "SpeedLayer", "Motive", "TVI Marketpro3", "Marketpro3", "Sokal",
  "Click Here Digital", "Autominer", "Dealer Insights", "Dealer World",
  "Dealer E-Process", "Dealer Eprocess", "DealerOn", "Tekobi", "Tecobi",
  "Hamlin And Associates", "Hamlin", "Constellations", "AEO", "GEO",
  
  // Fixed Ops
  "Dynatron", "Armatus", "Armatus FOPC", "FOPC", "Service Department Solutions",
  "Xtime", "DealerFX", "Dealer FX", "BG/TORQ", "TORQ", "BG", "Smart VMA",
  "TekWall", "techWall", "BizzyCar", "Avantaguard", "Workflow 360",
  "Mitchell Pro Demand", "Mitchell", "Jupiter", "Scott Russo", "Assurant",
  
  // Equity Mining
  "Auto Alert", "AutoAlert", "Apollo", "Fullpath", 
  "AMP", "Mastermind", "Automotive Mastermind",
  
  // Reconditioning
  "Rapid Recon", "Hubcap Haven", "iRecon", "VINCUE",
  
  // AI & Automation
  "Numa", "Warrcloud", "Impel AI", "Impel", "Matador AI", "Matador", "Pam",
  "AlphaDrive", "AlphaDrive AI", "AutoAce", "Kenect", "Kenect.Ai", "Autolabs",
  "Cora", "Cari AI", "CarWars", "Covideo", "Vibecodeapp", "Vibecode",
  "Claude", "Claude Code", "Cowork", "ChatGPT", "Gemini", "Grok",
  "Co-pilot", "Copilot", "AutoPixel", "Retell", "Elevenlabs",
  
  // Inventory
  "Precision Inventory", "Precision IM", "Carfax", "Carfax Listings", "KBB ICO", "KBB", 
  "Kelley Blue Book", "Shiftly", "Signal", "AutoHub", "Auto Hub", "Skaivision",
  "Auto iPacket", "iPacket", "CULA", "Carpages", "WhipFlip", "Traderev", "Buyanycar",
  "Kijiji", "VAuto", "vAuto", "V-Auto", "Motoacquire", "AccuTrade",
  "Blackbook", "Car and Driver", "eAuto Appraisals", "KBB LeadDriver",
  "KBB Trade-in Advisor", "Trade-in Valet", "Autotrader ICO", "Vizauto",
  
  // Training
  "Steve Shaw", "Chris Collins", "RockED", "Rock ED", "Rockstar", "NCM", "NCM 20", 
  "Andy Elliott", "Andy", "NADA", "NADA Dealer Academy", "RevDojo", "Kyle Disher",
  "Sellchology", "Jonathan Dawson", "Proactive Training Solutions",
  "Jonathan Mast", "ComplyAuto", "Comply Auto", "EOS", "Ethos Group",
  "Next Level Auto Group", "Tenex", "M5",
  
  // Accounting
  "Packer Thomas", "Brady Ware", "Crowe", "Woodward", "Woodward and Associates",
  "CorPay", "Yooz", "Cenpos", "Dealerpay", "DealerWorks", "Dealerworks", "Truvideo",
  "Budco", "Darwin", "Tyler Simms", "St. Sauveur", "Wihtium", "Withium",
  "Routeone", "RouteOne", "Protective",
  
  // HR & Payroll
  "Netchex", "Net Checks", "Paylocity", "ADP",
  
  // Service Products
  "Wynns", "10mm", "Grantize",
  
  // Diagnostics
  "Autel", "Vintel", "VINTEL", "VINSight", "Velocity Automotive", "Snap On", 
  "Snap on Solus", "Solus", "Coats Company",
  
  // Security
  "Bodyguard", "BayWatch", "Baywatch", "BayWatch Technologies", "UV Eye",
  "Stealth", "1Micro", "Field Effect", "Voisentry",
  
  // Lead Providers
  "AutoCheck", "Autocheck", "Edmunds", "Cars.com", "CarGurus", "Cargurus", "Autotrader",
  "Facebook Marketplace", "Canada Drives", "Truecar", "Carvana", "AutoNation",
  
  // Call Management
  "CallRevu", "Call Revu", "Test Track", "Volie", "Dealerwing", "Dealer wing",
  "Ring Central", "CallRail", "Revolver", "Text2drive", "GoTo", "Mitel", "Simple Fiber",
  
  // IT Support
  "Helion", "A&R Solutions", "EV Connect", "Blink", "Ntiva", "OWL Consulting",
  
  // Data & BI
  "Qore", "Todd", "C4", "Google Sheets",
  
  // F&I
  "Auto Trust Alliance", "Triton", "Ford Protect", "KPA", "Complynet", "Mosaic",
  
  // Other vendors
  "Cox", "NCC", "700", "GMF", "GM IMR", "Lovable", "Replit",
  "GoTo Meeting", "Google Meets", "Fathom", "Firefly", "SalesForce", "Hubspot",
  "Zoom", "J H Corp",
  
  // OEM Programs
  "Nissan DVB", "Nissan One", "Subaru SSLP", "Volvo Costco", "Ford EV",
  
  // OEM / Car brands (often mentioned with vendors)
  "Ford", "Lincoln", "Chevy", "Chevrolet", "GMC", "Toyota", "Lexus",
  "Hyundai", "Kia", "Nissan", "Rogue", "Honda", "Stellantis", "Subaru", "Volvo", "Ram",
  
  // New vendors from Circles Chat
  "Daily.therundown.ai", "The Rundown", "Voisentry", "Windowstickerlookup", 
  "AI Prompts for Entrepreneurs", "Working Genius", "Patrick Lencioni",
  "Tuscany", "DriveAI", "AutomotiveAccelerator", "Roush", "Amazon"
];

// Function to check if a character is a word boundary
const isWordBoundary = (char: string | undefined): boolean => {
  if (char === undefined) return true;
  return !/[a-zA-Z0-9]/.test(char);
};

// Function to blur vendor names in text
const blurVendorNames = (text: string): React.ReactNode => {
  let result: React.ReactNode[] = [];
  let remainingText = text;
  let keyIndex = 0;
  
  // Sort by length (longest first) to match longer names before shorter ones
  const sortedVendors = [...vendorNamesToBlur].sort((a, b) => b.length - a.length);
  
  while (remainingText.length > 0) {
    // Find the earliest vendor match in the remaining text (with word boundary check)
    let earliestIndex = -1;
    let matchedVendor = '';
    
    for (const vendor of sortedVendors) {
      const lowerRemaining = remainingText.toLowerCase();
      const lowerVendor = vendor.toLowerCase();
      let searchStart = 0;
      
      while (searchStart < lowerRemaining.length) {
        const index = lowerRemaining.indexOf(lowerVendor, searchStart);
        if (index === -1) break;
        
        // Check word boundaries
        const charBefore = remainingText[index - 1];
        const charAfter = remainingText[index + vendor.length];
        
        if (isWordBoundary(charBefore) && isWordBoundary(charAfter)) {
          if (earliestIndex === -1 || index < earliestIndex) {
            earliestIndex = index;
            matchedVendor = vendor;
          }
          break;
        }
        
        // Continue searching from after this match
        searchStart = index + 1;
      }
    }
    
    if (earliestIndex === -1) {
      // No more vendors found, add the rest as plain text
      result.push(remainingText);
      break;
    }
    
    // Add text before the vendor (if any)
    if (earliestIndex > 0) {
      result.push(remainingText.substring(0, earliestIndex));
    }
    
    // Add the blurred vendor name
    const matchedText = remainingText.substring(earliestIndex, earliestIndex + matchedVendor.length);
    result.push(
      <span key={keyIndex++} className="inline-block px-1 bg-foreground/10 rounded blur-[4px] select-none">
        {matchedText}
      </span>
    );
    
    // Continue with remaining text after the vendor
    remainingText = remainingText.substring(earliestIndex + matchedVendor.length);
  }
  
  return result.length > 0 ? result : text;
};

const vendorData: VendorEntry[] = [
  // DMS & CRM
  { id: 1, vendorName: "Tekion", title: "Smooth DMS Transition Experience", quote: "We just moved our Ford store to Tekion from CDK. This one was by far the best hands down. Our team embraced the change well, and we're very happy with the decision. Tekion is light years ahead.", explanation: "Modern DMS providers offer surprisingly smooth migration with better user adoption.", type: "positive", category: "dms-crm" },
  { id: 2, vendorName: "CDK", title: "Beware of Beta Features in Service Tools", quote: "We tried CDK Service for four months but ultimately canceled it. The demo looked amazing, but there were too many software issues and some demoed functions were still in beta.", explanation: "Some service tools have software bugs and incomplete features despite promising demos.", type: "warning", category: "dms-crm" },
  { id: 3, vendorName: "DriveCentric", title: "Top-Tier CRM Recommendation", quote: "Drive centric hands down for me... I'm really excited about what they are building. I will be at their HQ next week to speak with their Development team.", explanation: "This CRM is praised for innovation, integrations, and ease of transition.", type: "positive", category: "dms-crm" },
  { id: 4, vendorName: "VinSolutions", title: "Outdated CRM Functionality", quote: "We will be transitioning to Drive Centric from Vin in February - what are the top issues we should pay close attention to?", explanation: "Some CRMs are perceived as outdated, prompting dealerships to seek alternatives.", type: "warning", category: "dms-crm" },
  { id: 5, vendorName: "Auto/mate", title: "Good DMS Integration Experience", quote: "We were on Auto/mate DMS and Dealersocket CRM (both Solera products) and had little to no issues.", explanation: "Certain DMS and CRM combinations work well together for stable operations.", type: "positive", category: "dms-crm" },
  { id: 65, vendorName: "Qore", title: "Data Cleanup Leader", quote: "Anyone evaluate Qore? I've met Todd a few times and really like their approach. I don't think anyone is close to them for data cleanup, reporting, integrations.", explanation: "Some platforms excel at aggregating, cleaning, and deduplicating dealership data.", type: "positive", category: "dms-crm" },
  
  // Digital Retailing
  { id: 6, vendorName: "Gubagoo", title: "Game-Changing Digital Retailing Tool", quote: "I recently switched to Gubagoo for DR/chat/soft credit checks. It was a bit cumbersome to set up, but now that it's up and running, I couldn't imagine there's a better tool on the market.", explanation: "Despite setup challenges, this tool is praised for comprehensive digital retailing features.", type: "positive", category: "digital-retailing" },
  { id: 7, vendorName: "Podium", title: "Effective Reviews & Chat Platform", quote: "We have Podium (reviews/chat) and other bills for reimbursement... We use Drive Centric for CRM, and still have Podium as well.", explanation: "This platform is effective for managing online reviews and chat.", type: "positive", category: "digital-retailing" },
  
  // Marketing
  { id: 8, vendorName: "PureCars", title: "Questionable Marketing ROI", quote: "My GM has gone all in with Pure Cars the past year, and I'm having a really hard time seeing the ROI. I was on a call with them today and cut the spend.", explanation: "Some marketing vendors have poor performance and difficulty measuring results.", type: "warning", category: "marketing" },
  { id: 10, vendorName: "Clarivoy", title: "Multi-Touch Attribution Insights", quote: "Tools like Clarivoy clearly show how third-party sites influence early and mid-funnel activity, even if the final sale attributes to our website. It's critical for optimizing ad spend.", explanation: "Understanding the complete customer journey reveals which channels truly drive sales.", type: "positive", category: "marketing" },
  { id: 11, vendorName: "Capital One", title: "Direct Mail: Mixed Results", quote: "We spent $5,000 on cap one mailers in November. I can attribute 2 sales to them. We have done two cap one sales events for $17,000 each. So far only one deal from them.", explanation: "Direct mail campaigns may yield mixed results with high cost per acquisition.", type: "warning", category: "marketing" },
  { id: 13, vendorName: "Cedar Marketing", title: "Messenger Campaigns Delivered Results", quote: "We did several marketing campaigns with Cedar Marketing and had great results. They were messenger campaigns and they had a BDC that scheduled all the appointments.", explanation: "Messenger campaigns with BDC support delivered great results.", type: "positive", category: "marketing" },
  { id: 14, vendorName: "GoHighLevel", title: "Watch Out for Rebranded Software", quote: "Only recently discovered that driveai and automotiveaccelerator are literally just rebranded gohighlevel. Wild considering what they're charging dealers.", explanation: "Some AI tools are rebranded generic software sold at inflated prices.", type: "warning", category: "marketing" },
  
  // Fixed Ops
  { id: 15, vendorName: "Dynatron", title: "Powerful Fixed Ops Pricing Tool", quote: "I am a huge fan of Dynatron; we use them in all 14 new car stores, and we have the highest labor and parts markup in the district. You need to hold the team accountable.", explanation: "This tool analyzes pricing and identifies areas for increased profitability.", type: "positive", category: "fixed-ops" },
  { id: 16, vendorName: "Armatus", title: "Budget-Friendly Fixed Ops Alternative", quote: "Before you pull the trigger, look at Armatus Fixed Ops Performance Center FOPC. 1/3 of the price. We just signed 3 stores, to do an A/B challenge with Dynatron.", explanation: "A significantly more affordable alternative for fixed ops performance.", type: "positive", category: "fixed-ops" },
  { id: 17, vendorName: "Service Department Solutions", title: "Superior Warranty Rate Increase Results", quote: "Recommend you take a look at Service Department Solutions... Process takes a little longer but highly recommend. We had used Armatus in the past - numbers weren't even close.", explanation: "Highly recommended for warranty labor and parts rate increases.", type: "positive", category: "fixed-ops" },
  { id: 18, vendorName: "Xtime", title: "Best Service Scheduling Tool", quote: "We use a couple services, I think Xtime is best so far... Pam integrates with Xtime to read and insert appointments.", explanation: "Considered one of the best scheduling tools with strong AI integration.", type: "positive", category: "fixed-ops" },
  { id: 19, vendorName: "DealerFX", title: "Strong Service Operations Platform", quote: "Service has worked well for the process for both employees and customers reception have been exceptional. Dealer FX.", explanation: "Used for service operations with good process for employees and customers.", type: "positive", category: "fixed-ops" },
  { id: 20, vendorName: "BG/TORQ", title: "Effective Service Products Program", quote: "We use BG/TORQ. Have had good results. I really like the Smart VMA program. If you have a TORQ person also ask about their fixed fee program for supplies.", explanation: "These service products are praised for their VMA and fixed-fee programs.", type: "positive", category: "fixed-ops" },
  { id: 66, vendorName: "BizzyCar", title: "Effective Recall Management", quote: "If your brands have recalls, BizzyCar is good at getting customers in too.", explanation: "Some tools effectively drive repair orders through recall notifications.", type: "positive", category: "fixed-ops" },
  
  // Equity Mining
  { id: 23, vendorName: "Auto Alert", title: "Long-standing Equity Mining Tool", quote: "Looking for vendor options... Have used Auto Alert for years.", explanation: "A long-standing equity mining tool with years of dealer experience.", type: "positive", category: "equity-mining" },
  { id: 24, vendorName: "Mastermind", title: "Consolidated Equity Mining Solution", quote: "I'm considering cancelling Mastermind. We use Team V for website and their backend Apollo tool has very similar equity mining data.", explanation: "Some website providers offer comparable equity mining data.", type: "positive", category: "equity-mining" },
  
  // Reconditioning
  { id: 28, vendorName: "Rapid Recon", title: "Effective Recon Timing Tool", quote: "We use rapid recon at our stores but we have recon techs separate from retail techs. Rapid recon works pretty well as the cars are timed from when they go into dispatch.", explanation: "Effective for timing and prioritizing reconditioning with dedicated techs.", type: "positive", category: "recon" },
  
  // AI & Automation
  { id: 30, vendorName: "Numa", title: "AI for After-Hours Calls", quote: "Using AI-powered systems like Numa for after-hours and overflow calls frees up our BDC and advisors. It handles basic inquiries efficiently.", explanation: "Deploying AI for routine call handling ensures no inquiry is missed.", type: "positive", category: "ai-automation" },
  { id: 31, vendorName: "Warrcloud", title: "Warranty Automation: Cost vs. Value", quote: "I compared the cost of Warrcloud to our internal warranty clerks, and it was more expensive to switch. Plus, they won't fix bad processes or protect from audit debits.", explanation: "Some warranty automation may be more expensive than internal teams.", type: "warning", category: "ai-automation" },
  
  // Inventory
  { id: 34, vendorName: "Precision Inventory", title: "Specialized OEM Inventory Tool", quote: "If you have a Ford and/or Lincoln franchise, I would HIGHLY recommend checking out Precision Inventory. They can track Days on Lot and take over your ordering process.", explanation: "Specialized inventory tools provide comprehensive market data access.", type: "positive", category: "inventory" },
  { id: 35, vendorName: "Carfax Listings", title: "Unexpectedly Strong Listing Platform", quote: "We've had surprisingly good luck with Carfax Listings. Consistently getting better quality leads and more sales than Autotrader or Cars.com.", explanation: "Some listing platforms outperform established third-party platforms.", type: "positive", category: "inventory" },
  { id: 39, vendorName: "Signal", title: "Multi-Tool Acquisition Strategy", quote: "We currently have an acquisition team of 3 working Signal, KBB ICO, and AutoHub. That team is generating approximately 90+ units per month.", explanation: "A multi-tool strategy for used car acquisition drives substantial volume.", type: "positive", category: "inventory" },
  { id: 40, vendorName: "AutoHub", title: "Effective Service Drive Acquisition", quote: "We had a handful of stores on Skaivision and found AutoHub to be much more effective specifically regarding service drive acquisition.", explanation: "Some tools are more effective for service drive acquisition.", type: "positive", category: "inventory" },
  { id: 68, vendorName: "CULA", title: "Credit Union Leasing Alternative", quote: "Credit unions about 50% of our lease business... https://www.cula.com/", explanation: "Credit unions provide significant lease business with better rates.", type: "positive", category: "inventory" },
  { id: 70, vendorName: "Windowstickerlookup", title: "Window Sticker Tool for Appraisals", quote: "There is also a tool we use to run vin and get any window sticker, it helps us with trade appraisals and bookouts. Expense is $125 per month.", explanation: "Window sticker tools aid in trade appraisals and bookouts.", type: "positive", category: "inventory" },
  
  // Training
  { id: 41, vendorName: "Steve Shaw", title: "Effective Selling Phrases Training", quote: "Check out Steve Shaw training. He teaches advisors and techs phrases and key words to help sell. We use them for online and in person training.", explanation: "Teaches specific language and techniques to improve selling skills.", type: "positive", category: "training" },
  { id: 43, vendorName: "RockED", title: "Engaging Mobile Training Platform", quote: "I highly recommend getting a demo from RockED. It's kind of genius. They keep the training sessions under three minutes per day, and your people do it from their phones.", explanation: "Short, daily, mobile-based training with gamified elements.", type: "positive", category: "training" },
  { id: 44, vendorName: "NCM", title: "Best in the Business 20 Groups", quote: "I did NCM and do NCM 20 groups. Best in the biz IMO.", explanation: "Highly regarded for dealership training and peer-to-peer learning.", type: "positive", category: "training" },
  
  // Accounting
  { id: 46, vendorName: "Packer Thomas", title: "Highly Recommended Accounting Firm", quote: "We use Packer Thomas out of Ohio and I would highly recommend them. We hired them to investigate a possible theft and they quickly found it.", explanation: "Praised for investigative capabilities and expertise.", type: "positive", category: "accounting" },
  { id: 47, vendorName: "Brady Ware", title: "Project-Based Accounting Services", quote: "Brady Ware invoices are mainly project based. They do not charge for every tenth of an hour we communicate. I cannot recommend them enough.", explanation: "Project-based fee structure with comprehensive services.", type: "positive", category: "accounting" },
  
  // HR & Payroll
  { id: 49, vendorName: "Netchex", title: "Good HR/Payroll Platform", quote: "We use Netchex and I love it. Pros: it tracks everyone's vacation/pto requests and balances. Cons: some manual process still to pay the 401K.", explanation: "Praised for vacation/PTO tracking with some manual 401K steps.", type: "positive", category: "hr-payroll" },
  { id: 50, vendorName: "Paylocity", title: "Positive Payroll Transition", quote: "We switched to Paylocity in December we like it lots of set up.", explanation: "Positive reception despite significant setup process.", type: "positive", category: "hr-payroll" },
  
  // Service Products
  { id: 51, vendorName: "Wynns", title: "Service Product Vendor Warning", quote: "Be careful with Wynns products. We switched to 10mm products and they forcibly broke into our locked parts storage and stole their machines back after agreeing to credit us.", explanation: "A highly negative experience with alleged theft and failed refund.", type: "warning", category: "service-products" },
  
  // Diagnostics
  { id: 52, vendorName: "Autel", title: "Affordable and Effective Scanner", quote: "We use Autel as well for used car recon and diag. Works well. We have been happy with it. Around $2500.", explanation: "Cost-effective and reliable for diagnosing non-OEM vehicles.", type: "positive", category: "diagnostics" },
  { id: 53, vendorName: "Vintel", title: "Cheap and Easy Code Reader", quote: "I use Vintel. Maybe $200... Just a simple code reader, VINTEL is easy and cheap.", explanation: "Very affordable and user-friendly basic code reader.", type: "positive", category: "diagnostics" },
  { id: 54, vendorName: "VINSight", title: "Integrated OBD-II Scanner", quote: "We use Velocity Automotive's VINSight OBD-II scanner which is an upgrade inside Rapid Recon's reconditioning suite.", explanation: "Integrated diagnostic tool within reconditioning suites.", type: "positive", category: "diagnostics" },
  
  // Security
  { id: 55, vendorName: "Bodyguard", title: "Cost-Effective Vehicle Protection", quote: "We use Bodyguard in all of our stores. Maybe not as sophisticated as Baywatch but very reasonable as far as price. Has saved us thousands on customers claiming damage.", explanation: "Cost-effective solution for documenting vehicle condition.", type: "positive", category: "security" },
  { id: 56, vendorName: "BayWatch", title: "Service Lane Technology", quote: "We have BayWatch Technologies in a few of our stores and we have been super happy with them. Looking like we are going to add more.", explanation: "Positive feedback for service lane technology performance.", type: "positive", category: "security" },
  { id: 57, vendorName: "Stealth", title: "Effective Lot Monitoring", quote: "We use stealth who monitors and shouts at anything off hours.", explanation: "Active monitoring and vocal deterrence during off-hours.", type: "positive", category: "security" },
  { id: 58, vendorName: "1Micro", title: "Key Tracking System", quote: "We use 1Micro. It doesn't really track the vehicle per se, it tracks location where Key is currently at or where it was last taken from.", explanation: "Logs key location and personnel who remove them.", type: "positive", category: "security" },
  
  // Lead Providers
  { id: 59, vendorName: "AutoCheck", title: "Cost-Saving Vehicle History Alternative", quote: "We cut Carfax completely for AutoCheck and saved huge and haven't gotten one complaint.", explanation: "Significant cost savings without negative customer feedback.", type: "positive", category: "lead-providers" },
  { id: 60, vendorName: "Edmunds", title: "Cut Due to Low Volume", quote: "We cut Edmunds. Cargurus and Cars have been better to us in recent days, still low volume overall.", explanation: "Some lead providers don't provide sufficient ROI.", type: "warning", category: "lead-providers" },
  
  // Call Management
  { id: 61, vendorName: "CallRevu", title: "Call Tool: Good but Expensive", quote: "We used CallRevu. The advisors used it as a crutch and stopped answering calls. It got really expensive fast.", explanation: "Excellent for call evaluation but can become a costly crutch.", type: "warning", category: "call-management" },
  { id: 62, vendorName: "Volie", title: "Effective Service BDC Tool", quote: "Service BDC using Volie - this drives approx 40 appointments a day, but many of them are inbound.", explanation: "Effectively manages and generates substantial daily appointments.", type: "positive", category: "call-management" },
  { id: 63, vendorName: "Dealerwing", title: "Excellent Marketing Vendor", quote: "I use Dealerwing in a couple stores. I think they are excellent.", explanation: "Strong satisfaction among users for marketing services.", type: "positive", category: "call-management" },
  
  // IT Support
  { id: 64, vendorName: "A&R Solutions", title: "Specialized IT Support", quote: "I've been using A&R Solutions, they only support dealerships... but I believe they're only in Canada. Helion.", explanation: "Recommended IT providers for specialized dealership tech support.", type: "positive", category: "it-support" },
  
  // Additional DMS & CRM
  { id: 71, vendorName: "DealerSocket", title: "DealerSocket Data Export Nightmare", quote: "Only issue was with DealerSocket not wanting to give us our data which was a pain. Luckily DriveCentric was able to work around and we got our historical DMS data uploaded into the new CRM.", explanation: "DealerSocket creates challenges with data portability during CRM transitions.", type: "warning", category: "dms-crm" },
  { id: 72, vendorName: "Autosoft", title: "Autosoft Setup Complications", quote: "I was most interested in having a better and easier to train experience for employees and eliminating busy work due to the complicated setup of Autosoft.", explanation: "Autosoft DMS has complicated setup that creates training challenges.", type: "warning", category: "dms-crm" },
  { id: 73, vendorName: "Proton", title: "Reynolds Acquisition Maintains Quality", quote: "Proton - great relationship, now owned by Reynolds.", explanation: "Proton maintained great relationships even after Reynolds acquisition.", type: "positive", category: "dms-crm" },
  
  // Additional Digital Retailing
  { id: 74, vendorName: "Autofi", title: "Autofi: Expensive and Short-Lived", quote: "2 of our rooftops were on Autofi, needless to say, it did not last long.", explanation: "Autofi was quickly discontinued due to high cost and lack of sustained value.", type: "warning", category: "digital-retailing" },
  { id: 75, vendorName: "Trade Pending", title: "Trade Pending Lacks Innovation", quote: "We use Trade Pending and want to change. Not happy. Very vanilla.", explanation: "Trade Pending is described as lacking differentiation and innovation.", type: "warning", category: "digital-retailing" },
  
  // Additional Marketing
  { id: 76, vendorName: "Epsilon", title: "Epsilon Mailer for Database Re-engagement", quote: "We recently signed on for a GMF/Epsilon mailer. We felt it re-exposed us to a portion of our base that might be under communicated with in general.", explanation: "Epsilon mailers help re-engage existing customer databases.", type: "positive", category: "marketing" },
  { id: 77, vendorName: "Strategic", title: "Strategic Mailers Not Effective Everywhere", quote: "But mail in general for sales has not worked in my market. Tried Mudd, Epsilon, Strategic etc….", explanation: "Direct mail campaigns including Strategic are ineffective in some markets.", type: "warning", category: "marketing" },
  { id: 78, vendorName: "Willowood Ventures", title: "Willowood Ventures: Unproven Claims", quote: "Anyone used or heard of Willowood Ventures? They claim to guarantee 150 plus appts within a 7 day period. But I haven't seen the actual show rates and sell rates.", explanation: "Bold appointment guarantees but unproven conversion rates raise skepticism.", type: "warning", category: "marketing" },
  { id: 79, vendorName: "Adperance", title: "Adperance/Catalyst for SEO/SEM", quote: "We use Adperance which is changing names to Catalyst I believe.", explanation: "Adperance (now Catalyst) is used for SEO and SEM services.", type: "positive", category: "marketing" },
  { id: 80, vendorName: "SMedia", title: "SMedia for Social Activity", quote: "Have heard good things about Shiftly. We use SMedia for a lot of our social activity.", explanation: "SMedia is used for managing social media marketing activities.", type: "positive", category: "marketing" },
  { id: 81, vendorName: "Kijiji", title: "Kijiji Lead Quality Declining", quote: "I have Kijiji but now considering scaling back. Leads not as qualified... We were $6k+ a month on Kijiji for years but have scaled it back.", explanation: "Kijiji lead quality has declined, leading dealers to reduce spend.", type: "warning", category: "marketing" },
  
  // Additional AI & Automation
  { id: 82, vendorName: "Pam", title: "Pam AI: Effective After-Hours Solution", quote: "We use Pam for after hours and a back up if no one answers in a few stores... It's a good tool. Have been on it for a couple years.", explanation: "Pam AI effectively handles after-hours and backup calls with DMS integration.", type: "positive", category: "ai-automation" },
  { id: 83, vendorName: "AutoAce", title: "AutoAce for Backup Calls", quote: "We use Pam for after hours and a back up if no one answers in a few stores and AutoAce in another.", explanation: "AutoAce provides AI-powered after-hours and backup call support.", type: "positive", category: "ai-automation" },
  { id: 84, vendorName: "Kenect", title: "Kenect AI: Text and Voice Solutions", quote: "We use Kenect.Ai. They acquired our previous vendor Autolabs... They use text message AI for outbound reminders and prospecting and they provide voice AI for making inbound appts.", explanation: "Kenect.Ai offers both text and voice AI for customer communication.", type: "positive", category: "ai-automation" },
  { id: 85, vendorName: "AlphaDrive", title: "AlphaDrive AI for Service", quote: "I was told about AlphaDrive AI - maybe give them a demo for SVC.", explanation: "AlphaDrive AI is suggested as a potential service department AI solution.", type: "positive", category: "ai-automation" },
  { id: 86, vendorName: "CarWars", title: "Cora AI from CarWars: Fantastic for Appointments", quote: "I have Cora AI from CarWars setting inbound appointments at all stores and it is fantastic.", explanation: "CarWars' Cora AI is highly praised for setting inbound service appointments.", type: "positive", category: "ai-automation" },
  { id: 87, vendorName: "Numa", title: "Numa: Great for Fixed Ops Texting", quote: "We use Numa for fixed ops texting - integrated well and has definitely helped our advisors improve their communication.", explanation: "Numa integrates well and improves advisor communication in service.", type: "positive", category: "ai-automation" },
  
  // Additional Inventory
  { id: 88, vendorName: "Carpages", title: "Carpages: Budget ICO Alternative", quote: "Carpages has one for $30.", explanation: "Carpages offers an ICO product at $30 - a lower-cost alternative.", type: "positive", category: "inventory" },
  { id: 89, vendorName: "WhipFlip", title: "WhipFlip: Uncertain Value Proposition", quote: "Anyone heard of a tool called WhipFlip? Guys from Traderev/Buyanycar... last I heard they were in market trying to get acquired. Never really understood what makes them unique.", explanation: "WhipFlip's unique value proposition remains unclear to dealers.", type: "warning", category: "inventory" },
  
  // Additional Training
  { id: 90, vendorName: "RevDojo", title: "RevDojo Sales Training", quote: "We are looking at sales training companies - I'm going to checkout RevDojo with Kyle Disher.", explanation: "RevDojo with Kyle Disher is being considered for sales training.", type: "positive", category: "training" },
  { id: 91, vendorName: "Sellchology", title: "Sellchology Sales Training", quote: "Also Jonathan Dawson Sellchology.", explanation: "Jonathan Dawson's Sellchology is a sales training company under consideration.", type: "positive", category: "training" },
  { id: 92, vendorName: "Proactive Training Solutions", title: "Proactive Training Solutions", quote: "And Proactive Training Solutions.", explanation: "Proactive Training Solutions is being evaluated for sales training.", type: "positive", category: "training" },
  
  // Accounting additions
  { id: 93, vendorName: "Woodward", title: "Woodward and Associates: Local Specialist", quote: "We use a local one Woodward and Associates. They handle around 300 dealerships. We pay for services when done.", explanation: "Local accounting firm specializing in automotive with 300+ dealer clients.", type: "positive", category: "accounting" },
  
  // Websites
  { id: 94, vendorName: "Dealer Inspire", title: "Dealer Inspire: Best Website Performance", quote: "Seeing the best performance from DI these days... We have used DI for years. It's been good.", explanation: "Dealer Inspire delivers strong website performance for dealerships.", type: "positive", category: "marketing" },
  { id: 95, vendorName: "OEM Sites", title: "OEM Sites: Too Controlling", quote: "We have used DI for years. It's been good. But now switching away from OEM sites. Too controlling and bad customer experience.", explanation: "OEM-mandated websites can be restrictive with poor customer experience.", type: "warning", category: "marketing" },
  { id: 96, vendorName: "Dealer.com", title: "Dealer.com: Lacking Support", quote: "We have DI and haven't been happy with them for a while. We gave them our paid search this year, and they aren't performing there either. Support is lacking for us.", explanation: "Dealer.com is criticized for lacking support and underperforming in paid search.", type: "warning", category: "marketing" },
  { id: 97, vendorName: "Team Velocity", title: "Team Velocity: Great Platform, Use All Tools", quote: "I love Team Velocity in the process of switching to them now. I believe Feb 1... Team Velocity looks great but I think to maximize it you would need to utilize all of their tools.", explanation: "Team Velocity is excellent but requires full adoption of its suite.", type: "positive", category: "marketing" },
  { id: 98, vendorName: "OverFuel", title: "OverFuel Website Provider", quote: "I have heard good things about OverFuel. If anyone could give me any feedback on them, or anyone else they really like it would be greatly appreciated.", explanation: "OverFuel is an independent website provider with positive buzz.", type: "positive", category: "marketing" },
  { id: 99, vendorName: "SpeedLayer", title: "SpeedLayer Website Recommendation", quote: "For websites, SpeedLayer.", explanation: "SpeedLayer is recommended as a website provider.", type: "positive", category: "marketing" },
  { id: 100, vendorName: "Motive", title: "Motive Website: Not Recommended", quote: "Has anyone used Motive as a website provider? No we don't.", explanation: "Motive does not receive positive endorsement from dealers.", type: "warning", category: "marketing" },
  
  // Payment Processing
  { id: 101, vendorName: "Cenpos", title: "Cenpos: Frequent Downtime Issues", quote: "Our Cenpos is constantly down and requires IT intervention too frequently.", explanation: "Cenpos payment processor has frequent downtime causing operational issues.", type: "warning", category: "accounting" },
  { id: 102, vendorName: "CorPay", title: "CorPay for AP Automation", quote: "We use CorPay.", explanation: "CorPay is used for accounts payable automation.", type: "positive", category: "accounting" },
  { id: 103, vendorName: "Dealerpay", title: "Dealerpay Payment Processor", quote: "We are with Dealerpay.", explanation: "Dealerpay is a payment processor used by dealerships.", type: "positive", category: "accounting" },
  { id: 104, vendorName: "Truvideo", title: "Truvideo for Remote Payments", quote: "We're still a Reynolds shop with Reypay as our primary and Truvideo text/remote payments/backup through Worldbank.", explanation: "Truvideo provides text-based and remote payment solutions.", type: "positive", category: "accounting" },
  { id: 105, vendorName: "DealerWorks", title: "DealerWorks: Exploring Good Tech", quote: "Currently exploring Dealerworks - he has good references thus far and good tech.", explanation: "DealerWorks payment processor shows promise with good references.", type: "positive", category: "accounting" },
  
  // EV & Charging
  { id: 106, vendorName: "EV Connect", title: "EV Connect: Slow Invoice Payments", quote: "Strange question but does anyone have EV Connect as the software on their level 3 chargers and have they been slow paying invoices.", explanation: "EV Connect has issues with slow invoice payments for charging stations.", type: "warning", category: "it-support" },
  { id: 107, vendorName: "Blink", title: "Blink Chargers: Payment Collection Issues", quote: "Anyone having trouble collecting from Blink? They haven't paid us since June for our charger and the monies they collect 'for us'. All we get are standard emails without being able to speak to a human.", explanation: "Blink has significant delays in paying dealerships with poor customer service.", type: "warning", category: "it-support" },
  
  // Additional Lead Providers
  { id: 108, vendorName: "CarGurus", title: "Cargurus Outperforming Others", quote: "Cargurus is our biggest 3rd party lead generator (and it's not close) but Carfax listings is #2.", explanation: "Cargurus dominates as a lead generator for many dealers.", type: "positive", category: "lead-providers" },
  
  // CDP & Data
  { id: 109, vendorName: "Client Command", title: "Client Command CDP", quote: "Already do business with Client Command and they have a CDP product we are considering.", explanation: "Client Command offers a Customer Data Platform for data management.", type: "positive", category: "dms-crm" },
  { id: 110, vendorName: "Foundation Direct", title: "Foundation Direct for Analytics", quote: "Good morning everyone, is anyone using C4? Ford direct rep pushing them hard on me. We have a large metro store and I just launched Foundation.", explanation: "Foundation Direct is preferred over C4 for data analysis.", type: "positive", category: "dms-crm" },
  
  // F&I
  { id: 111, vendorName: "Auto Trust Alliance", title: "Auto Trust Alliance: Unproven Concept", quote: "Anyone dealing with Auto Trust Alliance? Supposed to group dealers to get better deals on F&I products and then use buying power for other things down the road.", explanation: "New alliance aims to leverage group buying power but benefits are unproven.", type: "warning", category: "accounting" },
  
  // Additional Fixed Ops
  { id: 112, vendorName: "TVI Marketpro3", title: "TVI Marketpro3 for Marketing", quote: "Dealer wing is one I wanna look into and TVI Marketpro3.", explanation: "TVI Marketpro3 is being evaluated for fixed ops marketing.", type: "positive", category: "fixed-ops" },
  { id: 113, vendorName: "Grantize", title: "Grantize Service Products", quote: "We use a company called Grantize.", explanation: "Grantize is used for service products.", type: "positive", category: "service-products" },
  
  // Multi-tool strategies
  { id: 114, vendorName: "UV Eye", title: "UV Eye vs BayWatch Comparison", quote: "Anyone use them? Very curious how this compares to UV Eye.", explanation: "Dealers compare BayWatch Technologies against UV Eye for service lane tech.", type: "positive", category: "security" },

  // === NEW ENTRIES 122-254 ===
  
  // Lead Providers & Third Party
  { id: 122, vendorName: "CarGurus", title: "CarGurus: Better Value Than Autotrader", quote: "I feel CarGurus is much better performing for the cost, and reinvesting the AT spend into ads (fb or other) would yield better results.", member: "Jason", explanation: "CarGurus often delivers better value than Autotrader, with some dealers reallocating budget elsewhere.", type: "positive", category: "lead-providers" },
  { id: 123, vendorName: "Autotrader", title: "Autotrader: High Cost, Poor Lead Quality", quote: "What's everyone's thoughts on AutoTrader? So many leads without phone numbers, closing ratio is horrendous. Thinking about jumping off the ship.", member: "Charles Montmigny", explanation: "Autotrader criticized for high costs, poor lead quality, and low closing ratios.", type: "warning", category: "lead-providers" },
  { id: 124, vendorName: "Canada Drives", title: "Canada Drives: Subprime Lead Source", quote: "We use Canada Drives nearly exclusively. You need either well equipped subprime sales people or an AI CRM that does it all for them.", member: "Jason", explanation: "Canada Drives provides subprime leads but requires skilled staff or AI CRM.", type: "positive", category: "lead-providers" },
  
  // DMS
  { id: 125, vendorName: "PBS", title: "PBS DMS: User-Friendly with Weak CRM", quote: "I am an independent on PBS, using the FULL suite including CRM. It was a pain to learn and setup...but I have a better dashboard and reporting is cleaner since the switch.", member: "Tyler", explanation: "PBS is user-friendly with good accounting but weak CRM function.", type: "positive", category: "dms-crm" },
  { id: 126, vendorName: "Avantaguard", title: "Avantaguard: Difficult Warranty Approvals", quote: "I used Avantaguard previously. They were VERY hard to get warranty work approved and limited $$ approvals.", member: "Tyler", explanation: "Avantaguard is reported to be very difficult for warranty approvals.", type: "warning", category: "fixed-ops" },
  
  // F&I
  { id: 127, vendorName: "Budco", title: "Budco Ford Protect: Set Higher Down Payments", quote: "Budco portal is exclusively what we use in the service department. Getting good leads from the Quicklane and service advisors after offering $50 spiff.", member: "Kim Ferguson", explanation: "Budco generates good leads; recommend 25% minimum down payment to mitigate losses.", type: "positive", category: "accounting" },
  { id: 128, vendorName: "Darwin", title: "Darwin F&I Menu Tool", quote: "We have Darwin and use their product follow up tool to market to anyone eligible for a Ford Protect contract that didn't purchase at time of new vehicle purchase.", member: "Ryan Knight", explanation: "Darwin is a preferred F&I menu tool with useful follow-up capabilities.", type: "positive", category: "accounting" },
  
  // Websites
  { id: 129, vendorName: "Tekobi", title: "Tekobi: Under Consideration", quote: "Any Ford stores using Tecobi? Does anyone use Tecobi in here?", member: "Nicholas Varela", explanation: "Tekobi is being discussed for Ford and Honda dealerships.", type: "positive", category: "marketing" },
  { id: 130, vendorName: "Dealer E-Process", title: "Dealer E-Process: Great for Kia", quote: "And my Kia dealership I use dealer e-process for my website and they were great.", member: "Mike Shackelford", explanation: "Dealer E-Process praised as a great website provider for Kia.", type: "positive", category: "marketing" },
  { id: 131, vendorName: "Team Velocity", title: "Team Velocity: Weak Website Development", quote: "Been using Team Velocity for about 15 years now. They're definitely not the best with websites... And their Dev team is lacking.", member: "Mike Shackelford", explanation: "Team Velocity criticized for website capabilities and lacking dev team.", type: "warning", category: "marketing" },
  { id: 132, vendorName: "Cars.com", title: "Cars.com: Questionable ROI", quote: "Our group is considering hopping on Autotrader to get more eyes on used vehicles. Currently on Cars.com and Cargurus. We are looking at dropping Cars because the ROI isn't there.", member: "Michael Clinton", explanation: "Cars.com being evaluated for discontinuation due to low ROI.", type: "warning", category: "lead-providers" },
  
  // Ford Specific
  { id: 133, vendorName: "C4", title: "C4: Ford Direct Pushing Hard", quote: "Good morning everyone, is anyone using C4? Ford Direct rep pushing them hard on me.", member: "Oleg Kislyansky", explanation: "C4 is actively promoted by Ford Direct representatives.", type: "positive", category: "marketing" },
  { id: 134, vendorName: "Precision Inventory", title: "Precision IM: Ford/Lincoln Inventory", quote: "If you have a Ford and or Lincoln franchise I would HIGHLY recommend checking out Precision Inventory. If you haven't heard of them you should reach out!", member: "Tim Cassios", explanation: "Precision IM highly recommended for Ford/Lincoln inventory optimization.", type: "positive", category: "inventory" },
  { id: 135, vendorName: "Reynolds Revolver", title: "Reynolds Revolver: Declined Service Follow-up", quote: "Is anyone on the Reynolds advanced services follow up for declined services including mail and email?", member: "Luke Czubay", explanation: "Reynolds offers advanced declined service follow-up via mail and email.", type: "positive", category: "fixed-ops" },
  
  // Phone & Call
  { id: 136, vendorName: "Ring Central", title: "Ring Central: Phone Service Integration", quote: "Does anyone have Drive Centric if so which phone service do you use with it?", member: "Louie Duvall", explanation: "Ring Central is a phone service being explored with DriveCentric.", type: "positive", category: "call-management" },
  { id: 137, vendorName: "CallRail", title: "CallRail: Call Tracking Alternative", quote: "One of our sister stores had CallRevu a few years ago after going to NADA. I use CallRail at my store, anyone have experiences with both?", member: "Nick Miller", explanation: "CallRail is an alternative call tracking service.", type: "positive", category: "call-management" },
  { id: 138, vendorName: "Covideo", title: "Covideo Replaced by CRM Integration", quote: "We've been leaning increasingly heavy into videos, we started with Covideo, but cancelled when we went live with DriveCentric as that is an embedded tool.", member: "Nick Miller", explanation: "Covideo replaced by DriveCentric's integrated video tools.", type: "positive", category: "ai-automation" },
  
  // Data & Marketing
  { id: 139, vendorName: "Autominer", title: "Autominer/PureCars: Data Cleaning", quote: "We use Purecars/Autominer. Combines DMS/CRM and other data, cleans it including updating vehicle and address info. Then sends email and SMS messages.", member: "Shelly W.", explanation: "Autominer integrates and cleans data for targeted campaigns.", type: "positive", category: "marketing" },
  { id: 140, vendorName: "Click Here Digital", title: "Click Here Digital: Co-op Available", quote: "Are you using Click Here Digital through Pure Cars or just Pure Cars straight? There is a co-op pass through deal.", member: "Tommy Rayl", explanation: "Click Here Digital partners with Pure Cars with co-op opportunities.", type: "positive", category: "marketing" },
  
  // Digital Retailing
  { id: 142, vendorName: "CarNow", title: "CarNow: Strong Ecosystem", quote: "Honestly CarNow. When I was a consultant many of my clients had CarNow... We started with Chat, but have since replaced most CTAs on our site with CarNow's ecosystem.", member: "Marc McGurren", explanation: "CarNow highly recommended for chat and digital retail with high closing rates.", type: "positive", category: "digital-retailing" },
  { id: 143, vendorName: "Dealer Insights", title: "Dealer Insights: LLM-Powered Dashboard", quote: "Dealer Insights. It's our entire marketing dashboard for all things digital... THE ABSOLUTE BEST part is that it has an LLM overlay to ask anything about your data in natural language.", member: "Marc McGurren", explanation: "Dealer Insights features LLM overlay for natural language data queries.", type: "positive", category: "marketing" },
  
  // Trade-in Tools
  { id: 144, vendorName: "Motoacquire", title: "Motoacquire: Outperforming AccuTrade", quote: "Motoacquire. Lot of us overlook trade in tool. Got to know Mike, their CEO. We used AccuTrade prior and already seen more leads sell and higher gross.", member: "Joey", explanation: "Motoacquire shows better results than AccuTrade for trade-ins.", type: "positive", category: "inventory" },
  { id: 145, vendorName: "AccuTrade", title: "AccuTrade: Good for Undisclosed Issues", quote: "For us, AccuTrade has been very good in ensuring we don't take cars in with undisclosed issues or inflated ACVs.", member: "GianMarco Taverna", explanation: "AccuTrade prevents acquisition of vehicles with undisclosed issues.", type: "positive", category: "inventory" },
  
  // Service
  { id: 146, vendorName: "Workflow 360", title: "Workflow 360: Seeking Feedback", quote: "Does anyone use Workflow 360 for their service department?", member: "Alex Shulman", explanation: "Dealers seeking feedback on Workflow 360 for service management.", type: "positive", category: "fixed-ops" },
  { id: 147, vendorName: "Autel", title: "Autel: Works Well for Recon", quote: "We have an Autel for Diag it was around $3k. We use Autel as well for used car recon and diag. Works well. We have been happy with it.", member: "Kevin", explanation: "Autel diagnostic tools work well for used car reconditioning.", type: "positive", category: "diagnostics" },
  { id: 148, vendorName: "Mitchell Pro Demand", title: "Mitchell Pro Demand: Service Info Tool", quote: "If you have a service like Mitchell Pro Demand. You only need a basic scan tool. Mitchell's can get you all the other info.", member: "Brandon Mason", explanation: "Mitchell Pro Demand reduces need for advanced scan tool features.", type: "positive", category: "diagnostics" },
  
  // OEM Specific
  { id: 149, vendorName: "Roadster", title: "Roadster as Lexus Monogram", quote: "Guys - for anyone with Lexus, is this new 'Monogram' DR platform simply Roadster repackaged? It looks like it.", member: "Andrew Wright", explanation: "Lexus 'Monogram' platform suspected to be rebranded Roadster.", type: "warning", category: "digital-retailing" },
  { id: 150, vendorName: "VINCUE", title: "VINCUE: New Favorite Across Rooftops", quote: "We switched to VINCUE last fall and love it. So far nobody across three rooftops is asking to go back.", member: "Mike Davis", explanation: "VINCUE positively received across multiple rooftops despite learning curve.", type: "positive", category: "inventory" },
  
  // Training
  { id: 152, vendorName: "NCM", title: "NCM Fixed Ops Seminar: Very Good", quote: "NADA but NCM Fixed Ops seminar I attended was very good.", member: "Kurt Hanks", explanation: "NCM Fixed Ops seminar highly regarded for training.", type: "positive", category: "training" },
  
  // Payment
  { id: 153, vendorName: "CDK SimplePay", title: "CDK SimplePay: Seeking Alternatives", quote: "Does anyone else have CDK SimplePay or maybe another payment processing system they like?", member: "Justin Edgar", explanation: "Dealers exploring CDK SimplePay and alternatives.", type: "positive", category: "accounting" },
  
  // Toyota SmartPath
  { id: 155, vendorName: "SmartPath", title: "SmartPath Sales: Staff Dependent", quote: "Smartpath sales for over two years, we do a good job with the tool. It's very dependent on the sales staff being confident with the tool.", member: "Richard Brunell", explanation: "SmartPath Sales effectiveness depends on staff confidence.", type: "positive", category: "digital-retailing" },
  { id: 156, vendorName: "SmartPath", title: "SmartPath Service: Great but Costly", quote: "Smartpath Service - We are looking into smartpath service. It's a great process and product. It's much better than sales for sure. Only thing is list building is not ideal.", member: "Richard Brunell", explanation: "SmartPath Service praised but cost-effectiveness questioned.", type: "positive", category: "fixed-ops" },
  { id: 157, vendorName: "SmartPath", title: "SmartPath F&I: Piloting Soon", quote: "We about to pilot SmartPath F&I, which will be interesting.", member: "Randall Weeks", explanation: "SmartPath F&I being piloted with interest.", type: "positive", category: "accounting" },
  { id: 158, vendorName: "UpdatePromise", title: "UpdatePromise: Rough Start, Improved", quote: "We also are on SmartPath service with UpdatePromise, been about 2 years on that one. It was very rough but have since come a long way.", member: "Randall Weeks", explanation: "UpdatePromise improved significantly after rough start.", type: "positive", category: "fixed-ops" },
  
  // PBS DMS
  { id: 159, vendorName: "PBS", title: "PBS: Good DMS, Weak CRM", quote: "We are on PBS and it works well for us. We switched a few stores back from CDK to PBS. Very user friendly and easy to use.", member: "Scott Gottschling", explanation: "PBS is user-friendly with good accounting but weak CRM and stiff integrations.", type: "positive", category: "dms-crm" },
  { id: 160, vendorName: "PBS", title: "PBS Integrated AI: Worth Exploring", quote: "Anyone tried the integrated AI tool for PBS CRM? I got an email about it a while back.", member: "Tyler", explanation: "PBS offers integrated AI tool for its CRM.", type: "positive", category: "ai-automation" },
  
  // Reporting
  { id: 161, vendorName: "Reverse Risk", title: "Reverse Risk: Great for Dashboard Visuals", quote: "I have a dashboard built for every department manager...And then I have Reverse Risk push out visuals daily, weekly, monthly.", member: "Tim Cassios", explanation: "Reverse Risk provides comprehensive daily/weekly/monthly reporting visuals.", type: "positive", category: "dms-crm" },
  
  // Marketing Agencies
  { id: 163, vendorName: "Sokal", title: "Sokal: Marketing Agency", quote: "Right now we are using Foundation for some stores and Sokal for others…", member: "Anthony Gardner", explanation: "Sokal is a marketing agency used by dealerships.", type: "positive", category: "marketing" },
  
  // AI Tools
  { id: 166, vendorName: "Eleads", title: "Eleads CRM: Seeking AI Integration", quote: "Where is a good place or resource to start learning about AI and ways it can help me manage my dealership and work inside my CRM (Eleads) if that's even possible.", member: "Brad Dawson", explanation: "Dealers exploring AI integration with Eleads CRM.", type: "positive", category: "ai-automation" },
  { id: 167, vendorName: "Vibecode", title: "Vibecodeapp: Mobile Apps with Claude", quote: "Vibecode app does mobile apps using Claude code. Simple and great founder.", member: "Jason", explanation: "Vibecode uses Claude code for mobile app development.", type: "positive", category: "ai-automation" },
  { id: 168, vendorName: "Lovable", title: "Lovable: Web Development Starting Base", quote: "For web stuff I'd use Lovable or Replit as a starting base.", member: "Jason", explanation: "Lovable recommended for web development projects.", type: "positive", category: "ai-automation" },
  { id: 170, vendorName: "Claude", title: "Claude Code: Powerful and Affordable", quote: "If you are a bit more technical I'd go with a Claude code subscription and then enable that extension in VSCode or Cursor. Max plan is only $200/mo too. Claude is my daily.", member: "Jason", explanation: "Claude Code recommended for coding with powerful capabilities.", type: "positive", category: "ai-automation" },
  { id: 174, vendorName: "Claude", title: "Claude Cowork Agent: Macro on Steroids", quote: "Has anyone played with the recently released Claude 'Cowork' agent? It is unbelievable. You can teach Claude to perform any task for you... It's a MACRO on steroids!", member: "Brian Fox", explanation: "Claude's Cowork agent enables powerful desktop task automation.", type: "positive", category: "ai-automation" },
  { id: 175, vendorName: "Jonathan Mast", title: "Jonathan Mast: Easy AI Courses", quote: "Look up Jonathan Mast. He does courses that are very, very easy to follow. He keeps things current, too.", member: "Tim Turner", explanation: "Jonathan Mast offers easy-to-follow AI courses for entrepreneurs.", type: "positive", category: "training" },
  
  // IT Support
  { id: 176, vendorName: "Ntiva", title: "Ntiva: Solid IT Support", quote: "We use Ntiva for basic network support and IT. Customer service is good and timely.", member: "Mike Davis", explanation: "Ntiva provides reliable network support with good customer service.", type: "positive", category: "it-support" },
  { id: 177, vendorName: "Field Effect", title: "Field Effect: Security Monitoring", quote: "We have a layered approach to the IT world with ComplyAuto for training and compliance, Ntiva for network, and Field Effect for security scanning.", member: "Mike Davis", explanation: "Field Effect provides security scanning and monitoring.", type: "positive", category: "security" },
  { id: 178, vendorName: "ComplyAuto", title: "ComplyAuto: Training and Compliance", quote: "We have a layered approach to the IT world with ComplyAuto for training and compliance.", member: "Mike Davis", explanation: "ComplyAuto used for dealership training and compliance.", type: "positive", category: "training" },
  { id: 179, vendorName: "Voisentry", title: "Voisentry: Live Security Monitoring", quote: "Thank you Mike, we also use ComplyAuto, and company called Voisentry for live monitoring.", member: "JB Brown", explanation: "Voisentry provides live security monitoring services.", type: "positive", category: "security" },
  { id: 180, vendorName: "OWL Consulting", title: "OWL Consulting: Quality IT People", quote: "Check out OWL Consulting. Quality people.", member: "Dave Rogers", explanation: "OWL Consulting recommended for quality IT personnel.", type: "positive", category: "it-support" },
  
  // Advertising
  { id: 211, vendorName: "Google Ads", title: "Google Ads: Strong ROI", quote: "We're heavy on Google Ads. It generates about 10% more leads than organic. Meta has never worked well for us.", member: "Tim Turner", explanation: "Google Ads consistently delivers strong ROI and higher lead generation.", type: "positive", category: "marketing" },
  { id: 212, vendorName: "Meta", title: "Meta Ads: Mixed Results", quote: "Meta has never worked well for us.", member: "Tim Turner", explanation: "Meta advertising yields inconsistent results for some dealerships.", type: "warning", category: "marketing" },
  
  // Third Party Leads
  { id: 218, vendorName: "Autotrader", title: "Autotrader: Mixed Closing Ratios", quote: "Autotrader 25.71%... Does any other group with 5 or more brands individualize the stores to sign up with Autotrader or do you do it at the group level?", member: "Bryan Gelfand", explanation: "Autotrader has mixed closing ratios with group vs individual store debate.", type: "warning", category: "lead-providers" },
  { id: 219, vendorName: "CarGurus", title: "CarGurus: Solid Lead Generator", quote: "CarGurus 12.5%... CarGurus is our biggest 3rd party lead generator and it's not close.", member: "Bryan Gelfand", explanation: "CarGurus is a significant lead generator outperforming others.", type: "positive", category: "lead-providers" },
  { id: 220, vendorName: "Carfax", title: "Carfax: High Cost, Some Cut It", quote: "We looked at CarFax, but it was pricey. We cut Carfax completely for AutoCheck and saved huge.", member: "Mike Trevino", explanation: "Carfax considered pricey; AutoCheck saves money without negative impact.", type: "warning", category: "lead-providers" },
  { id: 222, vendorName: "Truecar", title: "Truecar: Right Idea", quote: "I think Google is taking the 3rd party's lunch. Truecar I feel has the right idea.", member: "Mike Trevino", explanation: "Truecar viewed positively for its evolving strategy.", type: "positive", category: "lead-providers" },
  
  // Compliance
  { id: 226, vendorName: "ComplyAuto", title: "ComplyAuto: Loved It", quote: "Love Comply Auto.", member: "Tim Turner", explanation: "ComplyAuto is highly regarded for compliance.", type: "positive", category: "training" },
  
  // Accounting
  { id: 227, vendorName: "Tyler Simms", title: "Tyler Simms & St. Sauveur: Automotive Tax", quote: "We utilize Wihtium which is a national form great resources. Also have Tyler, Simms & St. Sauveur out of New Hampshire who are well versed in automotive and tax.", member: "JB Brown", explanation: "Tyler Simms & St. Sauveur specializes in automotive and tax.", type: "positive", category: "accounting" },
  { id: 228, vendorName: "Withium", title: "Wihtium: National Accounting Resources", quote: "We utilize Wihtium which is a national form great resources including a labor/parts warranty dept.", member: "JB Brown", explanation: "Wihtium provides national accounting resources for warranty.", type: "positive", category: "accounting" },
  
  // GM Specific
  { id: 230, vendorName: "GM IMR", title: "GM IMR Funds: Need Expert Help", quote: "Who really understands how to maximize GM IMR that is willing to jump on a quick call with me?", member: "Scott Edward Simons", explanation: "Dealers seeking expertise on maximizing GM IMR funds.", type: "positive", category: "marketing" },
  
  // Tekion CRM
  { id: 231, vendorName: "Tekion", title: "Tekion CRM: Not Ready Yet", quote: "I will say their CRM is not ready. We're currently on it and I'm playing with the idea of going back to Vin or looking at Drive Centric.", member: "Joey", explanation: "Tekion's CRM considered not fully developed yet.", type: "warning", category: "dms-crm" },
  
  // Stellantis Options
  { id: 232, vendorName: "Car and Driver", title: "Car and Driver Trade-in: Stellantis Option", quote: "Of the approved Stellantis digital options is anyone using one that they feel is excellent?", member: "John Gabriele", explanation: "Car and Driver offers approved trade-in tool for Stellantis.", type: "positive", category: "inventory" },
  
  // Autofi
  { id: 238, vendorName: "Autofi", title: "Autofi: Expensive Rates", quote: "Can anyone using AutoFI share with me their rates? I was just quoted and although I knew it was going to be expensive, it exceeded my expectations.", member: "Nick Huff", explanation: "Autofi rates reported to exceed expectations in cost.", type: "warning", category: "digital-retailing" },
  
  // Autotrader ICO
  { id: 239, vendorName: "Autotrader", title: "Autotrader ICO: Worth It at $40/Lead", quote: "Anyone here using AutoTrader ICO for acquisitions? A lot don't reply, but at $40 a lead, and buying back of wholesale for every one of those so far, it's worth it.", member: "Jason", explanation: "Autotrader ICO at $40/lead can be profitable for wholesale acquisitions.", type: "positive", category: "inventory" },
  
  // Regional Variations
  { id: 240, vendorName: "Autotrader", title: "Autotrader: Regional Performance Varies", quote: "Trader and Gurus are very regional results wise. When I was with AutoCan, Brantford had high Gurus penetration. Hamilton and London, Trader has better results.", member: "Matthew Bird", explanation: "Autotrader performance varies significantly by region.", type: "positive", category: "lead-providers" },
  
  // Websites
  { id: 241, vendorName: "Dealer World", title: "Dealer World: Website Provider", quote: "We are with Foundation Direct at our Hyundai store. We use Dealer World at our other stores.", member: "Andrew Wright", explanation: "Dealer World is used as a website provider.", type: "positive", category: "marketing" },
  { id: 242, vendorName: "Foundation Direct", title: "Foundation Direct: Good Data Analysis", quote: "Foundation was much better at analyzing the data and giving feedback. Personally I use Foundation to analyze my analytics through my NCM 20 group.", member: "Tony Auletto", explanation: "Foundation Direct praised for data analysis capabilities.", type: "positive", category: "marketing" },
  
  // Pricing
  { id: 243, vendorName: "vAuto", title: "Velocity Pricing: Erodes Front End", quote: "We have been experimenting with velocity pricing model vs a bucket model. We have only seen velocity erode front end but not yield a large enough turn to make up.", member: "Marcello", explanation: "Velocity pricing model observed to erode front-end gross.", type: "warning", category: "inventory" },
  
  // DMS Transitions
  { id: 183, vendorName: "CDK", title: "CDK Global: Many Transitioning Away", quote: "We moved to Tekion from CDK a year ago and have been happy as well... We have 2 years away from our CDK contract ending.", member: "Doug", explanation: "Many dealerships transitioning away from CDK to newer systems.", type: "warning", category: "dms-crm" },
  { id: 184, vendorName: "Reynolds", title: "Reynolds: Dealers Leaving After Decades", quote: "We have been on Reynolds for 30 years. We switched from Reynolds to Tekion in January of 24. No looking back.", member: "D. Cooper", explanation: "Long-time Reynolds users are switching away, citing better alternatives.", type: "warning", category: "dms-crm" },
  
  // Acquisition
  { id: 194, vendorName: "Blackbook", title: "Blackbook/Auction: Challenging Environment", quote: "A high percentage of older cars are ending up auctioned out. Unfortunately many dealers in our community are using Blackbook/auction for customer numbers.", member: "Sean", explanation: "Blackbook/auction used for customer numbers in challenging acquisition market.", type: "warning", category: "inventory" },
  
  // Google Sheets
  { id: 254, vendorName: "Google Sheets", title: "Google Sheets: Free Inventory Tracking", quote: "Anybody using Google Sheets to track inventory progress? Yes, I've been using it in multiple stores for years. You can lock down cells and assign editing access. It keeps a full audit log.", member: "Jason Wilkins", explanation: "Google Sheets is free and effective for tracking inventory progress.", type: "positive", category: "inventory" },
  
  // iRecon
  { id: 192, vendorName: "iRecon", title: "iRecon: Automated Workflow Management", quote: "Once a deal with a trade is 'Accepted,' it automatically pushes it to iRecon, including any photos saved in vAuto. It alerts me to start a recon process.", member: "Jameson Riley", explanation: "iRecon automates recon workflows integrating with DMS and vAuto.", type: "positive", category: "recon" },
  
  // VAuto
  { id: 193, vendorName: "vAuto", title: "VAuto: Huge Role in Used Car Growth", quote: "Last year we did this with V-Auto, and set up weekly meetings with them to evaluate our inventory and pricing strategy. That one change played a huge role in our used car growth.", member: "Devan Monette", explanation: "VAuto weekly meetings contributed significantly to used car growth.", type: "positive", category: "inventory" },
  
  // Carvana
  { id: 187, vendorName: "Carvana", title: "Carvana: Zero Fees Experience", quote: "I wanted to follow up. I personally buy a new vehicle from Carvana and see what happens. There were zero fees zero surprises. They didn't even charge a doc fee.", member: "Josh Potts", explanation: "Carvana offers frictionless buying with zero fees.", type: "positive", category: "lead-providers" },
  
  // Impel AI
  { id: 190, vendorName: "Impel AI", title: "Impel AI: Just OK Performance", quote: "Does anyone use Impel AI? We use them for service marketing. They are just OK in my opinion. I'm interested in looking at alternatives.", member: "Chris Way", explanation: "Impel AI for service marketing considered just OK by some.", type: "warning", category: "ai-automation" },
  
  // Rockstar Training
  { id: 210, vendorName: "RockED", title: "RockED: Retention Through Training", quote: "Sales training 2-3 times per week with new sales hires. We are 72% team members retention with 650+ team members.", member: "Vinnie Pontius", explanation: "Training programs like RockED contribute to 72% team retention.", type: "positive", category: "training" },

  // === COMPREHENSIVE VENDOR INSIGHTS ===
  // Note: Summarized entries (IDs 300-319) removed - replaced by authentic quotes elsewhere in the file
  // Authentic DriveCentric: ID 603 | Authentic Tekion: IDs 1, 629 | Authentic CDK: ID 2
  // Authentic Claude: IDs 402-404, 600 | Authentic Numa: IDs 30, 87, 409, 410, 692, 693
  
  // Carfax Listings
  { id: 320, vendorName: "Carfax", title: "Carfax Listings: 100% GM Co-opable", quote: "Carfax listings are 100% GM co-opable and consistently deliver better quality leads than competitors.", explanation: "Carfax listings offer free co-op for GM dealers with quality leads.", type: "positive", category: "lead-providers" },
  
  // Cars.com Warning
  { id: 321, vendorName: "Cars.com", title: "Cars.com: Poor ROI and Reporting", quote: "We dropped Cars.com - poor ROI and poor reporting. Costly with a low closing rate of 2-4%. Hard to justify the spend.", explanation: "Cars.com struggles with ROI justification for many dealers.", type: "warning", category: "lead-providers" },
  
  // Facebook Marketplace Success
  { id: 322, vendorName: "Facebook Marketplace", title: "Facebook Marketplace: 15-20 Units Monthly", quote: "We've had good success with Facebook Marketplace for used cars - selling 15-20 units a month. Also effective for new cars at 5-7 units monthly. We use Shiftly at $899/month to automate it.", explanation: "Facebook Marketplace delivers strong used car volume at low cost.", type: "positive", category: "marketing" },
  
  // Google Ads Insights
  { id: 323, vendorName: "Google Ads", title: "Google Ads: 70/30 Search/Pmax Sweet Spot", quote: "We've found a sweet spot with Google Ads at 70/30 Search/Pmax ratio. Demand Gen was ineffective for us and PMAX for brand terms resulted in 99% service appointments instead of sales.", explanation: "Optimal Google Ads mix is 70% Search, 30% Pmax with brand exclusions.", type: "positive", category: "marketing" },
  
  // KBB ICO Insights - Authentic quotes
  { id: 324, vendorName: "KBB", title: "KBB ICO: Beat Their Conservative Offers", quote: "We've found reviewing every offer immediately and offering more than KBB makes us stand out. Not all cars do we put a higher pass on, but most as KBB is conservative.", explanation: "Beating KBB's conservative appraisals helps you stand out and win trades.", type: "positive", category: "inventory" },
  { id: 325, vendorName: "KBB", title: "KBB ICO: Conversion Dropped from 10% to 5%", quote: "We were at 10% but it's fallen to 5% the last two months. No notable process or people changes. We kicked most of our KBB 'buying centers,' for a litany of reasons. Spend is too high, leads were not producing.", explanation: "KBB ICO conversion can drop significantly - monitor spend vs results.", type: "warning", category: "inventory" },
  
  // Kijiji Warning - Authentic quote
  { id: 326, vendorName: "Kijiji", title: "Kijiji: Marketplace Ate Their Marketshare", quote: "Kijiji tho? Joke. Marketplace ate every bit of their marketshare. I have Kijiji but now considering scaling back. Leads not as qualified.", explanation: "Facebook Marketplace has replaced Kijiji for most dealers.", type: "warning", category: "lead-providers" },
  
  // Motoacquire - Authentic quote
  { id: 327, vendorName: "Motoacquire", title: "Motoacquire: CEO Is a Pleasure to Work With", quote: "Got to know Mike, their CEO. He's a pleasure to work with and get everything set up. We used AccuTrade prior and already seen more leads, sells and higher gross.", explanation: "Motoacquire CEO provides hands-on support with better results than AccuTrade.", type: "positive", category: "inventory" },
  
  // Meta Ads Comparison - Authentic quote
  { id: 328, vendorName: "Meta", title: "Meta/Google: Higher Gross Than 3rd Party", quote: "Leads gross way higher than 3rd party leads, also conversions are higher.", explanation: "Direct ad leads convert better than third-party marketplace leads.", type: "positive", category: "marketing" },
  
  // Purecars Warning - Authentic quote
  { id: 329, vendorName: "PureCars", title: "PureCars Raw: No Bueno", quote: "Pure Cars raw is no bueno. It does not push clean data back to DMS or CRM. I didn't see the needle move in 4 months nor did I feel important to them at all and their responsiveness was trash.", explanation: "PureCars doesn't push cleaned data back and has poor responsiveness.", type: "warning", category: "marketing" },
  
  // Shiftly - Keep as is (authentic-ish)
  { id: 330, vendorName: "Shiftly", title: "Shiftly: Good Things Heard", quote: "Have heard good things about Shiftly.", explanation: "Shiftly has positive word-of-mouth for Facebook Marketplace automation.", type: "positive", category: "marketing" },
  
  // Team Velocity - Authentic quote
  { id: 331, vendorName: "Team Velocity", title: "Team Velocity: Great But Use All Tools", quote: "I love Team Velocity in the process of switching to them now. I believe Feb 1... Team Velocity looks great but I think to maximize it you would need to utilize all of their tools.", explanation: "Team Velocity is excellent but requires full adoption of its suite.", type: "positive", category: "marketing" },
  
  // Dealer Insights - Authentic quote
  { id: 332, vendorName: "Dealer Insights", title: "Dealer Insights: Absolute BONKERS Insights", quote: "I used to have the Mudd data analyst come in monthly but found the Dealer Insights LLM overlay to be far superior. Ability to ask questions to your data in natural language is absolute BONKERS.", explanation: "Dealer Insights LLM enables natural language queries for marketing data.", type: "positive", category: "marketing" },
  
  // Constellations AEO - Authentic quote
  { id: 333, vendorName: "Constellations", title: "Constellations: First AEO/GEO Product", quote: "Check out Constellations new SEO+AEO product. First I've seen that is now tackling Answer Engine Optimization, also known as GEO. This is an exercise that more retailers should be looking at in my opinion.", explanation: "Constellations leads in Answer Engine Optimization for AI search visibility.", type: "positive", category: "marketing" },
  
  // Comply Auto - Authentic quote  
  { id: 334, vendorName: "ComplyAuto", title: "ComplyAuto: Love It", quote: "Love Comply Auto.", explanation: "Comply Auto is highly regarded for compliance.", type: "positive", category: "training" },
  
  // KPA/Complynet Warning - Authentic quote
  { id: 335, vendorName: "KPA", title: "KPA/Complynet: Not the Same After Merger", quote: "We were originally KPA for EHS and Complynet for front of house, but then they merged and it hasn't been the same.", explanation: "KPA/Complynet merger degraded service quality - dealers are switching.", type: "warning", category: "training" },
  
  // Warrcloud Issues
  { id: 336, vendorName: "Warrcloud", title: "Warrcloud: Timing Issues and Poor Support", quote: "We've had timing issues with Warrcloud and their support after 5 PM is insufficient. Hard to get help when you need it.", explanation: "Warrcloud after-hours support is a significant gap.", type: "warning", category: "ai-automation" },
  
  // iRecon Integration
  { id: 337, vendorName: "iRecon", title: "iRecon: Free with Dealertrack/vAuto", quote: "We got iRecon at no additional cost as part of our Dealertrack and vAuto renewal. It tracks every step and holds employees accountable.", explanation: "iRecon included free with Dealertrack/vAuto bundle.", type: "positive", category: "recon" },
  
  // Rapid Recon Limitations
  { id: 338, vendorName: "Rapid Recon", title: "Rapid Recon: Software Doesn't Fix Bad Process", quote: "Rapid Recon has some holes. The software alone doesn't fix bad processes - you need good systems in place first.", explanation: "Recon software requires good processes to be effective.", type: "warning", category: "recon" },
  
  // Bodyguard for Lease Returns
  { id: 339, vendorName: "Bodyguard", title: "Bodyguard: Protects Against Lease Damage Claims", quote: "We use Bodyguard for all our lease returns to protect against damage accusations. Very reasonable price.", explanation: "Bodyguard protects against false damage claims on lease returns.", type: "positive", category: "security" },
  
  // Training Programs (see IDs 604, 636, 637 for authentic quotes)
  { id: 343, vendorName: "RockED", title: "RockED: Genius Training Approach", quote: "We use RockED for training - under three minutes daily via mobile, incorporates awards, and fosters competitiveness. High-quality, non-cheesy videos.", explanation: "RockED's micro-learning approach drives engagement and retention.", type: "positive", category: "training" },
  { id: 344, vendorName: "Scott Russo", title: "Scott Russo: Service Department Success", quote: "Scott Russo trained our service department advisors and managers across three stores. Great results.", explanation: "Scott Russo delivers effective service department training.", type: "positive", category: "training" },
  { id: 345, vendorName: "Service Department Solutions", title: "Service Dept Solutions: Honda 172% Warranty", quote: "We used Service Department Solutions and achieved 172% warranty approval above door rate for our Honda store. Kia store increased from 174% to 189%.", explanation: "Service Dept Solutions delivers exceptional warranty rate results.", type: "positive", category: "fixed-ops" },
  
  // Phone Systems
  // Phone Systems - see IDs 493-499, 608 for authentic quotes
  // OEM Programs - see IDs 483-492, 625-626 for authentic quotes
  // Equity Mining - see IDs 476 for authentic quotes
  // Duplicates removed: IDs 346-370 had summarized language

  // NEW DETAILED QUOTES WITH DIRECT MEMBER ATTRIBUTIONS
  
  // Accounting - Brady Ware Deep Dive
  { id: 400, vendorName: "Brady Ware", title: "Brady Ware: Complete Dealership Services", quote: "Brady Ware they were invoices are mainly project based. They do not charge for every tenth of an hour we communicate. I cannot recommend them enough. I brought them in on a non automotive related merger last year and they had the correct people on their bench to handle the specific tasks we for needed tax, 401k and real estate. A cost segregation study for real estate at your new store should help accelerate the depreciation and is a service they do. They also have an affiliated dealer service group that can help with your back end products, reinsurance and compliance audits.", explanation: "Brady Ware offers project-based billing with specialists for tax, 401k, real estate, cost segregation, and compliance.", type: "positive", category: "accounting" },
  
  // Packer Thomas Deep Dive
  { id: 401, vendorName: "Packer Thomas", title: "Packer Thomas: Uncovered Internal Theft", quote: "We use Packer Thomas out of Ohio and I would highly recommend them. Previously used Woodward and Assoc. We hired Packer Thomas on a recommendation from a dealer in our 20 group to come in and investigate a possible theft within our accounting office, which they quickly found. We were super impressed with them and switched over.", explanation: "Packer Thomas successfully investigated and found internal theft, leading to a full vendor switch.", type: "positive", category: "accounting" },
  
  // Claude AI - Detailed Use Cases
  { id: 402, vendorName: "Claude", title: "Claude AI: Desktop Task Automation", quote: "Has anyone played with the recently released Claude 'Cowork' agent within ClaudeAI? It is unbelievable. I'm planning to use it for a lot of data extraction. We have reports built to give us visibility of data, but with our DMS (Dealertrack) it still requires a fair bit of manual extraction because we have multiple rooftops. With Cowork you can teach Claude to perform any task for you and once it's taught, you just click a button and it will do it all. ANY TASK within your desktop. It's a MACRO on steroids!", explanation: "Claude Cowork can automate any desktop task including multi-rooftop DMS data extraction.", type: "positive", category: "ai-automation" },
  { id: 403, vendorName: "Claude", title: "Claude AI: Best Value for Coding", quote: "Claude code is a steal at $200/mon for the max plan. Max plan is only $200/mo too. Claude is my daily.", explanation: "Claude's Max plan at $200/month is considered the best value for technical work.", type: "positive", category: "ai-automation" },
  { id: 404, vendorName: "Claude", title: "Claude AI: Watch the Yes-Man Tendency", quote: "Just fair warning. It wants to make you happy and will yes-man you right off a cliff. So just don't forget the occasional smell test.", explanation: "AI tools like Claude need human verification - they'll agree with bad ideas.", type: "warning", category: "ai-automation" },
  { id: 405, vendorName: "AI", title: "AI Strategy: Pick One Problem First", quote: "Instead of trying to learn about 'AI'. I would recommend picking a super specific problem you're pretty confident AI should solve for you, and try to solve it. Automated reporting, follow up emails, responding to google reviews etc.", explanation: "Start AI adoption with one specific problem rather than broad 'AI learning'.", type: "positive", category: "ai-automation" },
  
  // ChatGPT Use Cases
  { id: 406, vendorName: "ChatGPT", title: "ChatGPT: Multiple Dealership Applications", quote: "We use it for writing vehicle descriptions, sales training, helping sales people with scripts/follow up, diag assistance for off brand vehicles in service.", explanation: "ChatGPT serves multiple dealership functions from descriptions to diagnostics.", type: "positive", category: "ai-automation" },
  
  // Matador AI Deep Dive
  { id: 407, vendorName: "Matador", title: "Matador AI: 1,000 Daily Follow-ups", quote: "We have Matador AI here for sales follow up but we can input 1k people a day via an Excel list and tell it what follow up to do and it will do that independent of regular sales follow up. I use it for service stuff and maturity leads already, it ran my buying center for a while too. We escalated leads when we had engagement. Eliminates the heavy lifting and doesn't get discouraged like we would.", explanation: "Matador AI processes 1,000 daily entries for automated follow-up without fatigue.", type: "positive", category: "ai-automation" },
  { id: 408, vendorName: "Matador", title: "Matador AI: Service and Sales Inbound", quote: "We will be live with Matador Ai for service and sales inbound calls soon. Links to Xtime or CDK and others to be pretty hands off on the service side.", explanation: "Matador AI integrates with Xtime and CDK for hands-off inbound call handling.", type: "positive", category: "ai-automation" },
  
  // Numa Deep Dive
  { id: 409, vendorName: "Numa", title: "Numa: 10,762 Monthly Texts Across 4 Stores", quote: "We started NUMA outbound text campaigns a couple months ago (we already used it to support inbound calls for past 2+ years). It is specifically sending outbound texts to all customers getting a 'Service Connect alert' which is the alert sent to the dealership when the car is due for maintenance or other service alert. Still fine timing reporting but we sent 10,762 text messages through this platform last month (4 stores).", explanation: "Numa sends 10K+ monthly service connect alerts via text across multiple stores.", type: "positive", category: "ai-automation" },
  { id: 410, vendorName: "Numa", title: "Numa: Reduced Failed Call Rate", quote: "We've been happy with Numa backing up our Service Department for missed calls. Has significantly reduced our failed call rate.", explanation: "Numa significantly reduces missed calls as a service department backup.", type: "positive", category: "ai-automation" },
  { id: 411, vendorName: "CallRevu", title: "CallRevu: Expensive If Overused as Crutch", quote: "Yes and it got expensive cause my advisors stopped answering calls and let CallRevu do it.", explanation: "AI call tools become expensive when staff rely on them instead of answering.", type: "warning", category: "call-management" },
  
  // Qore/QoreAI Deep Dive
  { id: 412, vendorName: "Qore", title: "Qore: Unmatched Data Cleanup", quote: "Anyone evaluate Qore? I've met Todd a few times and really like their approach. I don't think anyone is close to them for data cleanup, reporting, integrations, and really like their approach. Qore is focused on aggregating your data, cleaning it up, then letting you do whatever you want with it. It becomes your business intelligence platform, marketing pulls from this so it's always good data, and it's not dependent on APIs and feeds from vendors for getting the data.", explanation: "Qore provides independent data aggregation and cleanup not reliant on vendor APIs.", type: "positive", category: "ai-automation" },
  
  // Skaivision Deep Dive
  { id: 413, vendorName: "Skaivision", title: "Skaivision: Low Acquisition Conversion", quote: "We've been averaging somewhere between 1 to 1 1/2% but we're going to move the process down to the used car manager to hopefully improve that conversion rate with better engagement because the BDC is not as effective at it when it comes to the nuances of used cars.", explanation: "Skaivision service drive acquisition converts at 1-1.5% without strong process.", type: "warning", category: "ai-automation" },
  { id: 414, vendorName: "Skaivision", title: "Skaivision: Good Tool Needs Good Process", quote: "It was a good tool but you still need a good process to support it. When I demo Ska it was more of a production effectiveness monitoring tool for fixed ops. Shows which tech stand around talking or on their phone.", explanation: "Skaivision monitors tech productivity but requires strong processes to convert.", type: "warning", category: "fixed-ops" },
  { id: 415, vendorName: "Skaivision", title: "Skaivision: Camera Integration Too Creepy", quote: "I didn't have the camera integration. That was a little too creepy for me.", explanation: "Some dealers avoid Skaivision camera monitoring features due to privacy concerns.", type: "warning", category: "fixed-ops" },
  
  // Voice AI Warning
  { id: 416, vendorName: "Voice AI", title: "Voice AI: All Inbound is Poor Experience", quote: "We only use voice AI for calls not picked up. I tried sending all inbound calls to voice AI and the results are bad, it's a poor experience and not great for retention.", explanation: "Routing ALL inbound calls to voice AI hurts retention - use only for overflow.", type: "warning", category: "ai-automation" },
  
  // DriveCentric Deep Dive
  { id: 417, vendorName: "DriveCentric", title: "DriveCentric: Incredible Communication Visibility", quote: "We are loving DriveCentric, the visibility on communication and follow up tasks is incredible. I also love that management can step in and respond in any conversation, and can even make it look like the salesman is still talking. Really easy to hop in and help if someone is stuck.", explanation: "DriveCentric lets managers seamlessly assist in conversations appearing as the salesperson.", type: "positive", category: "dms-crm" },
  { id: 418, vendorName: "DriveCentric", title: "DriveCentric: Modern and Simple", quote: "We use DC love the simplicity of the tool. I can look at the bill but we are on the package that includes video etc and we also have their AI follow up. Not super advanced, but it does get the customer engaged at a high rate then flips to a sales rep. Switched from eleads and I'm very pleased with it.", explanation: "DriveCentric is simple, modern, with video and AI follow-up that engages customers.", type: "positive", category: "dms-crm" },
  { id: 419, vendorName: "DriveCentric", title: "DriveCentric: Cost Per Rooftop", quote: "Cost I'll circle back roughly $3 to $5k a roof top based on features you want they have built in AI that is strong. It is $6k per rooftop, but if all rooftops are named the same, perhaps you can get away with sharing. We couldn't.", explanation: "DriveCentric costs $3K-$6K per rooftop depending on features and naming.", type: "positive", category: "dms-crm" },
  
  // Tekion DMS Deep Dive
  { id: 420, vendorName: "Tekion", title: "Tekion: Light Years Ahead, Cut Bill in Half", quote: "We switched from Reynolds to Tekion in January of 24. No looking back. Reynolds' only redeeming product is reverse risk. Tekion is light years ahead. Wonderful customer service and leadership. Not to mention cut our bill in half.", explanation: "Tekion halved DMS costs while providing superior service versus Reynolds.", type: "positive", category: "dms-crm" },
  { id: 421, vendorName: "Tekion", title: "Tekion: Best DMS Transition Ever", quote: "We just moved our Ford store to Tekion from CDK. Going through a few DMS conversions in the past, this one was by far the best hands down. On site team was great, our team has embraced the change well. We are 1 month in and so far we are very happy with the decision to move over to Tekion. We will be moving our Chevy store next year.", explanation: "Tekion delivers the smoothest DMS transition experience with excellent on-site support.", type: "positive", category: "dms-crm" },
  { id: 422, vendorName: "Tekion", title: "Tekion: Digital Retail Needs Work Until 2026", quote: "The only disappointment with Tekion is their Digital Retail tool. They need to redo it, but it's not going to happen until the end of 2026 at the earliest.", explanation: "Tekion's digital retail tool is a disappointment - major update not until late 2026.", type: "warning", category: "dms-crm" },
  { id: 423, vendorName: "Tekion", title: "Tekion CRM: Not Ready, Horrific Support", quote: "I will say their CRM is not ready. We're currently on it and I'm playing with the idea of going back to Vin or looking at DriveCentric. Lastly, Tekion CRM support is horrific as well. Stretched too thin, not enough knowledge.", explanation: "Tekion CRM is not ready for prime time with poor support - consider DriveCentric.", type: "warning", category: "dms-crm" },
  
  // CDK Deep Dive
  { id: 424, vendorName: "CDK", title: "CDK: Decades of Learned Inefficiencies", quote: "The amount of learned inefficiencies that come with decades of CDK is very large. It's a big opportunity for us to rip the Band-Aid off and become a more efficient store.", explanation: "Long-term CDK use creates hidden inefficiencies - switching is an opportunity.", type: "warning", category: "dms-crm" },
  { id: 425, vendorName: "CDK", title: "CDK Service: Demo vs Reality Gap", quote: "We tried it out for 4 months and ultimately decided to cancel it. The demo made it look amazing but they definitely have some issues they need to get ironed out on the software side. Ended up being more time consuming and you still have to use the 'drive' side of CDK for some functions. Also would make CDK lock up and some of the functions they show you in the demo are still in beta and only available to some dealers. So not everything you see in the demo you can actually use yet.", explanation: "CDK Service beta features shown in demos aren't available to all dealers yet.", type: "warning", category: "dms-crm" },
  
  // Reynolds Deep Dive
  { id: 426, vendorName: "Reynolds", title: "Reynolds: 30 Years of Setup Anxiety", quote: "Giving me anxiety just reading this…we have been on Reynolds for 30 years…17 for me. The amount of dynamic reports and specific items I've set up…man oh man.", explanation: "Decades on Reynolds creates switching anxiety due to complex custom setups.", type: "warning", category: "dms-crm" },
  
  // PBS Deep Dive
  { id: 427, vendorName: "PBS", title: "PBS: Nightcap Reports for Dashboards", quote: "PBS just introduced something similar. It's called nightcap reports. It can report on any dashboard you've set up in PBS.", explanation: "PBS's new nightcap reports can automate any dashboard reporting.", type: "positive", category: "dms-crm" },
  
  // CarNow Deep Dive
  { id: 428, vendorName: "CarNow", title: "CarNow: High Teens to Low 20% Closing Rates", quote: "Honestly CarNow. When I was a consultant many of my clients had CarNow, and when I came aboard Keating Auto Group, they had just started rolling it out to a few stores. We started with Chat, but have since replaced most CTAs on our site with CarNow's ecosystem. Most of our stores are closing at high teen to low 20%, and grosses are healthy. Support has been great as well. SUPER happy with them.", explanation: "CarNow delivers 15-20% closing rates with healthy grosses and great support.", type: "positive", category: "digital-retailing" },
  
  // Dealer Insights LLM Deep Dive
  { id: 429, vendorName: "Dealer Insights", title: "Dealer Insights: Natural Language Data Queries", quote: "The other one, and most have never heard of, Dealer Insights. Its our entire marketing dashboard for all things digital. Any lead source, we have every piece of website data on every visit for every single of our 31 websites. THE ABSOLUTE BEST part is that it has an LLM overlay for to be able to ask anything about your data in natural language. THIS alone is worth the entry fee. The way you can now harness all of your SEO, SEM, VLAs, referral, inventory, SRP, VDPs, CTAs, and the list goes on. Allows me to just start asking questions and the insights it can give you is absolute BONKERS.", explanation: "Dealer Insights LLM lets you ask natural language questions about all your marketing data.", type: "positive", category: "marketing" },
  
  // Carfax Listings Deep Dive
  { id: 430, vendorName: "Carfax", title: "Carfax Listings: Better Than AT and Cars.com", quote: "We have had surprisingly good luck with Carfax Listings. They were not on my radar, but they threw them in on our deal free for a few months when we switched our history reports from Autocheck over to them. Saw strong results immediately so we kept it. Consistently getting better quality leads and more sales than we are with Autotrader or Cars.com. Cargurus is our biggest 3rd party lead generator (and it's not close) but Carfax listings is #2.", explanation: "Carfax Listings outperforms Autotrader and Cars.com for lead quality and sales.", type: "positive", category: "lead-providers" },
  { id: 431, vendorName: "Carfax", title: "Carfax Listings: GM Co-op Requirement", quote: "It's 100% coop able through GM but if only sign up with Carfax it's not coop able…", explanation: "Carfax Listings requires signing through GM for co-op eligibility.", type: "warning", category: "lead-providers" },
  
  // CarGurus Deep Dive
  { id: 432, vendorName: "CarGurus", title: "CarGurus: Biggest Lead Generator by Far", quote: "I feel CarGurus is much better performing for the cost, and reinvesting the AT spend into ads (fb or other) would yield better results. Cargurus is our biggest 3rd party lead generator (and it's not close).", explanation: "CarGurus dominates third-party lead generation and is better value than Autotrader.", type: "positive", category: "lead-providers" },
  { id: 433, vendorName: "CarGurus", title: "CarGurus/Cars: 2-4% Close Rate", quote: "We only close 2-4% of these leads compared to 10-15% on other sources, but they do still add up to a lot of car deals that we can tie to form submissions.", explanation: "Third-party marketplace leads close at 2-4% versus 10-15% from other sources.", type: "warning", category: "lead-providers" },
  
  // Cars.com Deep Dive
  { id: 434, vendorName: "Cars.com", title: "Cars.com: Poor ROI, Can't Measure", quote: "I canceled cars.com poor reporting can't measure ROI. We are actually looking at dropping cars because the ROI isn't there. It's just not making sense anymore.", explanation: "Cars.com has poor reporting making ROI measurement impossible.", type: "warning", category: "lead-providers" },
  
  // Facebook Marketplace Deep Dive
  { id: 435, vendorName: "Facebook Marketplace", title: "Facebook Marketplace: 15-20 Cars Monthly", quote: "We have been using Facebook Marketplace for almost 2 years for used cars and had good success with it. What worked with us is that every rep is logged into the same account in order to be able to not duplicate leads, enable faster response time and make it easy for our managers to track performance and conformity. We sell 15-20 cars per month from there.", explanation: "Facebook Marketplace sells 15-20 cars monthly with shared account approach.", type: "positive", category: "marketing" },
  
  // Google Ads Deep Dive
  { id: 436, vendorName: "Google Ads", title: "Google Ads: 70/30 Search/PMAX Sweet Spot", quote: "We do very well with them. Great ROI and quality leads. IT generates about 10% more leads than organic. We found our sweet spot with 70/30 Search/Pmax. We do a brand exclusion on PMAX for that reason. We also connected a Google Sheet with sold customer data to add as exclusions.", explanation: "Optimal Google Ads mix is 70% Search, 30% PMAX with brand exclusions.", type: "positive", category: "marketing" },
  { id: 437, vendorName: "Google Ads", title: "Google PMAX: 99% Service Appointments", quote: "As for PMAX - we found only the VLAs are effective - don't use PMAX for brand campaigns because we got a list of all the click to calls and found they were 99% service department appointments / visits.", explanation: "PMAX brand campaigns drive service calls, not sales - use VLAs only.", type: "warning", category: "marketing" },
  
  // KBB ICO Deep Dive
  { id: 438, vendorName: "KBB", title: "KBB ICO: Exceed Conservative Offers", quote: "We've found reviewing every offer immediately and offering more than KBB makes us stand out. Not all cars do we put a higher pass on, but most as KBB is conservative.", explanation: "Beating KBB's conservative appraisals helps you stand out and win trades.", type: "positive", category: "inventory" },
  { id: 439, vendorName: "KBB", title: "KBB ICO: Dropped from 10% to 5%", quote: "We were at 10% but it's fallen to 5% the last two months. No notable process or people changes. We kicked most of our KBB 'buying centers,' for a litany of reasons. Spend is too high, leads were not producing.", explanation: "KBB ICO conversion can drop significantly without apparent cause.", type: "warning", category: "inventory" },
  
  // Pure Cars Deep Dive
  { id: 440, vendorName: "PureCars", title: "Pure Cars: Raw is No Bueno", quote: "Pure Cars raw is no bueno. It does not push clean data back to DMS or CRM but does have some limited bidirectional communication with CRM depending on platform. I didn't see the needle move in 4 months nor did I feel important to them at all and their responsiveness was trash. Just never felt the love.", explanation: "Pure Cars doesn't push cleaned data back to source systems and lacks responsiveness.", type: "warning", category: "marketing" },
  
  // Foundation Direct Deep Dive
  { id: 441, vendorName: "Foundation", title: "Foundation Direct: Great Analysis, Poor Execution", quote: "We have some stores on C4 and have had several of the Hyundai stores on with Foundation and the feedback I got was Foundation was much better at analyzing the data and giving feedback than executing. Personally I use Foundation to analyze my analytics through my NCM 20 group and I am happy with the service they provide. I do a monthly meeting with them to go over recommendations and they always have good feedback.", explanation: "Foundation Direct excels at data analysis but struggles with execution.", type: "positive", category: "marketing" },
  { id: 442, vendorName: "Foundation", title: "Foundation Direct: Requires Hands-On", quote: "We use Foundation and it seems to require too much hands-on involvement to get value.", explanation: "Foundation Direct requires significant dealer involvement to extract value.", type: "warning", category: "marketing" },
  
  // Warrcloud Deep Dive
  { id: 443, vendorName: "Warrcloud", title: "Warrcloud: More Expensive Than Internal", quote: "I compared cost of WarrCloud to our costs with our internal warranty clerks and it was more expensive to switch.", explanation: "Warrcloud costs more than maintaining internal warranty clerks.", type: "warning", category: "ai-automation" },
  { id: 444, vendorName: "Warrcloud", title: "Warrcloud: Won't Fix Bad Processes", quote: "Beware, these warranty admin companies will not fix bad processes and won't protect you from warranty audit debits (despite their guarantees) because they don't see the RO hard copy where most debits take place; notes, mileage, add-on signatures, etc. Speaking from 1st hand experience.", explanation: "Warrcloud guarantees don't protect against audit debits from RO documentation issues.", type: "warning", category: "ai-automation" },
  { id: 445, vendorName: "Warrcloud", title: "Warrcloud: Poor After-Hours Support", quote: "We used them and they were good at processing but we ran into timing issues where we didn't get enough support past 5pm closing at the end of the pay period.", explanation: "Warrcloud support drops off after 5pm when you need it most.", type: "warning", category: "ai-automation" },
  
  // iRecon Deep Dive
  { id: 446, vendorName: "iRecon", title: "iRecon: Free with Dealertrack/vAuto Bundle", quote: "We got iRecon at no additional cost as part of a renewal with Dealertrack and vAuto, and it does everything we need for recon and automatically syncs with our DMS. Once a deal with a trade is 'Accepted,' which stocks it in, or an acquired used car is stocked in, it automatically pushes it to iRecon, including any photos saved in vAuto. It alerts me to start a recon process, of which I custom created for our store. If a car sells, it automatically updates iRecon.", explanation: "iRecon comes free with Dealertrack/vAuto and auto-syncs the entire recon flow.", type: "positive", category: "recon" },
  
  // Rapid Recon Deep Dive
  { id: 447, vendorName: "Rapid Recon", title: "Rapid Recon: Software Doesn't Fix Bad Process", quote: "Rapid Recon might be good for a larger store, I tried it in the past but found it had some holes I wasn't fond of. Software doesn't fix bad processes.", explanation: "Rapid Recon has limitations and won't fix underlying process problems.", type: "warning", category: "recon" },
  
  // Bodyguard Deep Dive
  { id: 448, vendorName: "Bodyguard", title: "Bodyguard: Saved Thousands on Damage Claims", quote: "We use Bodyguard in all of our stores, maybe not as sophisticated as Baywatch but very reasonable as far as price. Has saved us thousands on customers claiming we damaged their car. We also run every lease return through it to prevent customers from accusing us of damages.", explanation: "Bodyguard pays for itself by preventing false damage claims on service and leases.", type: "positive", category: "security" },
  
  // Kijiji Deep Dive
  { id: 449, vendorName: "Kijiji", title: "Kijiji: Marketplace Ate Its Marketshare", quote: "Kijiji tho? Joke. Marketplace ate every bit of their marketshare. I have Kijiji but now considering scaling back. Leads not as qualified.", explanation: "Facebook Marketplace has replaced Kijiji for most dealers.", type: "warning", category: "marketing" },
  
  // Motoacquire Deep Dive
  { id: 450, vendorName: "Motoacquire", title: "Motoacquire: CEO Is a Pleasure to Work With", quote: "Motoacquire. Lot of us overlook trade in tool. Got to know Mike, their CEO. He's a pleasure to work with and get everything set up. We used AccuTrade prior and already seen more leads, sells and higher gross. If they don't sell, there's a retargeting aspect like Carvana where they get an updated value each month from us.", explanation: "Motoacquire CEO provides hands-on support with monthly retargeting like Carvana.", type: "positive", category: "inventory" },
  
  // AccuTrade Deep Dive
  { id: 451, vendorName: "AccuTrade", title: "AccuTrade: Prevents Undisclosed Issues", quote: "For us, AccuTrade has been very good in ensuring we don't take cars in with undisclosed issues or inflated ACVs.", explanation: "AccuTrade protects against acquiring vehicles with hidden problems.", type: "positive", category: "inventory" },
  
  // Comply Auto Deep Dive
  { id: 452, vendorName: "ComplyAuto", title: "Comply Auto: Highly Effective Training", quote: "ComplyAuto for training and compliance. Love Comply Auto.", explanation: "Comply Auto is the most loved compliance training solution.", type: "positive", category: "training" },
  
  // KPA/Complynet Warning
  { id: 453, vendorName: "KPA", title: "KPA/Complynet: Merger Hurt Service", quote: "Looking for vendor options to consider to replace KPA/Complynet for Privacy & Safeguards, EHS and F&I online training/compliance. We were originally KPA for EHS and Complynet for front of house, but then they merged and it hasn't been the same.", explanation: "KPA/Complynet merger degraded service quality - dealers are switching.", type: "warning", category: "training" },
  
  // RockED Deep Dive
  { id: 454, vendorName: "RockED", title: "RockED: Under 3 Minutes Daily on Phone", quote: "I highly recommend getting a demo from RockED. It's kind of genius. They keep the training sessions under three minutes per day, and your people do it from their phones. The videos are high quality, and the training is not 'cheesy,' offering small, cumulative tips.", explanation: "RockED delivers genius micro-learning under 3 minutes daily via mobile.", type: "positive", category: "training" },
  
  // Chris Collins Deep Dive
  { id: 455, vendorName: "Chris Collins", title: "Chris Collins: Pricey and Not Sustainable", quote: "Chris Collins is pricey and not sustainable for a quick fix. We saw increased gross but declining Customer Pay RO count from the aggressive pricing strategy.", explanation: "Chris Collins drives short-term gross but can hurt long-term CP RO counts.", type: "warning", category: "training" },
  
  // EOS Deep Dive - Authentic quote
  { id: 456, vendorName: "EOS", title: "EOS: Game Changer for Accountability", quote: "Had our focus day yesterday with leaders for our journey on EOS.. really eye catching that we have never really had a good operational system to keep us on track or accountable. Exciting! It's a great system.", explanation: "EOS provides a game-changing framework for dealership accountability.", type: "positive", category: "training" },
  
  // Blink Chargers Deep Dive
  { id: 457, vendorName: "Blink", title: "Blink: Haven't Paid Since June", quote: "Anyone having trouble collecting from Blink? They haven't paid us since June for our charger and the monies they collect 'for us'??? All we get are standard emails without being able to speak to a human.", explanation: "Blink has severe payment collection issues and no human support.", type: "warning", category: "it-support" },
  
  // Ford Protect/Darwin Deep Dive
  { id: 458, vendorName: "Darwin", title: "Darwin: Preferred Ford Protect Menu Provider", quote: "We have Darwin and use their product follow up tool to market to anyone who is eligible for a Ford Protect contract that didn't purchase at the time of new vehicle purchase. They are the preferred menu provider for Ford Protect as well.", explanation: "Darwin is the preferred Ford Protect menu provider with follow-up tools.", type: "positive", category: "accounting" },
  
  // Toyota SmartPath Deep Dive - Authentic quote
  { id: 459, vendorName: "SmartPath", title: "SmartPath Sales: Runs Pretty Smooth", quote: "We've been on SmartPath Sales for about three years now and it runs pretty smooth. We use it for 100% of our retail deals. Its very dependent on the sales staff being confident with the tool.", explanation: "SmartPath works well when sales staff are confident with the tool.", type: "positive", category: "digital-retailing" },
  
  // Nissan DVB Deep Dive - Authentic quote
  { id: 460, vendorName: "Nissan DVB", title: "Nissan DVB: Objectives Are Insane", quote: "Nissan DVB objectives are insane. We end up spending $3 to make $1 through excessive trade-ins or unnecessary rentals just to hit their targets.", explanation: "Nissan DVB forces unprofitable behaviors to hit insane objectives.", type: "warning", category: "marketing" },
  
  // GM IMR Deep Dive - Authentic quote
  { id: 461, vendorName: "GM IMR", title: "GM IMR: 5X ROI on SFE Enrollment", quote: "GM IMR allocated to SFE enrollment yielded a return of over $300,000 for a $60,000 investment. Successfully used for SAVIs, iPads, and maintenance sticker printers.", explanation: "GM IMR funds deliver 5X ROI when strategically allocated to SFE enrollment.", type: "positive", category: "marketing" },
  
  // Volvo Costco Deep Dive
  { id: 462, vendorName: "Volvo Costco", title: "Volvo Costco: Drives Sales", quote: "Volvo Costco program works and drives car sales. Not perceived as degrading the brand but rather as a positive association.", explanation: "Volvo Costco partnership drives sales without brand degradation.", type: "positive", category: "marketing" },
  
  // CallRevu Test Track Deep Dive - Authentic quote
  { id: 463, vendorName: "CallRevu", title: "CallRevu Test Track: AI Phone Training", quote: "CallRevu's Test Track offers AI phone training. You can create scenarios to train teams and coach salespeople.", explanation: "CallRevu Test Track provides AI-powered phone training with custom scenarios.", type: "positive", category: "call-management" },
  
  // GoTo Phone System - Authentic quote
  { id: 464, vendorName: "GoTo", title: "GoTo: Phone System That Works Great", quote: "We are using GoTo and it works great.", explanation: "GoTo is a reliable, well-functioning phone system option.", type: "positive", category: "call-management" },
  
  // Mitel Warning - Authentic quote
  { id: 465, vendorName: "Mitel", title: "Mitel: Not User-Friendly", quote: "Mitel is not user-friendly and has poor call quality.", explanation: "Mitel has usability and call quality problems.", type: "warning", category: "call-management" },
  
  // Text2drive Deep Dive - Authentic quote
  { id: 466, vendorName: "Text2drive", title: "Text2drive: Great for Follow-up", quote: "We use Text2drive for follow-up, recalls, and next/declined services. Works great but no AI component.", explanation: "Text2drive excels at service follow-up but without AI automation.", type: "positive", category: "call-management" },
  
  // Subaru SSLP Deep Dive - Authentic quote
  { id: 467, vendorName: "Subaru SSLP", title: "Subaru SSLP: Increase Service Capacity", quote: "We use Subaru SSLP as a crutch to increase service capacity, capture service opportunities, and improve retention. Sales gets added RDR. We split depreciation 50/50 between New Car and Service.", explanation: "Subaru loaner program builds service capacity with creative depreciation splits.", type: "positive", category: "fixed-ops" },
  
  // Service Dept Solutions Deep Dive
  { id: 468, vendorName: "Service Department Solutions", title: "Service Dept Solutions: Flat Fee Pricing", quote: "We brought in Service Department Solutions. Process takes a little longer but highly recommended. Flat fee pricing and the numbers weren't even close compared to Armatus.", explanation: "Service Dept Solutions delivers exceptional warranty rate increases with flat fees.", type: "positive", category: "fixed-ops" },
  
  // Routeone Deep Dive
  { id: 469, vendorName: "Routeone", title: "Routeone: $99 Per Website Adds Up Fast", quote: "Routeone wants $99 per website and that would add up on multiple child sites. If I only put it on our group site then I have to pick one stores Routeone to put it in and that may not be what store the customer is working with.", explanation: "Routeone's $99/website pricing creates problems for multi-rooftop groups.", type: "warning", category: "accounting" },
  
  // Precision Inventory Deep Dive
  { id: 470, vendorName: "Precision Inventory", title: "Precision Inventory: Found a Loophole", quote: "Precision Inventory works with Ford/Lincoln franchises, having found a loophole to access all inventory data. It tracks Days on Lot and product ordering constraints, allowing it to take over inventory allocation and ordering. Considered a 'biggest win' in the past couple of years.", explanation: "Precision Inventory found a loophole for complete Ford/Lincoln inventory access.", type: "positive", category: "inventory" },
  
  // CULA Deep Dive
  { id: 471, vendorName: "CULA", title: "CULA: $125 Cheaper Per Month", quote: "Credit unions about 50% of our lease business. CULA credit union leases are often $125 cheaper per month.", explanation: "CULA credit union leasing undercuts captive rates by $125/month.", type: "positive", category: "inventory" },
  
  // Mudd Mailers Deep Dive
  { id: 472, vendorName: "Mudd", title: "Mudd Mailers: 223 Units from 40K Piece", quote: "Mudd mailers do work sold 223 units in our group on 40,000 total piece mailer November. Our Ford store does a mailer 2-3 times per year and sells 20-25 each time. Trade in post card.", explanation: "Mudd mailers sold 223 units from 40K pieces - highly effective in right markets.", type: "positive", category: "marketing" },
  { id: 473, vendorName: "Mudd", title: "Mudd Mailers: Minimal Success in Boston", quote: "Mail in general for sales has not worked in my market. Tried Mudd, Epsilon, Strategic etc. Mudd mailers experienced 'minimal success' and 'didn't positive ROI' in the metro Boston market.", explanation: "Mudd mailers fail in some metro markets like Boston - results are regional.", type: "warning", category: "marketing" },
  
  // Wynns Deep Dive
  { id: 474, vendorName: "Wynns", title: "Wynns: Broke In and Stole Equipment", quote: "Be careful with Wynns products. We switched to 10mm products, better margins. My Wynns story is when we switched we agreed that would credit us back for the on shelf product. We had their equipment in a locked parts storage area which they forcibly broke into and stole their machines back. They have ghosted us on the refund.", explanation: "Wynns allegedly broke into locked storage to take equipment and ghosted on refund.", type: "warning", category: "service-products" },
  
  // Auto Alert Deep Dive
  { id: 475, vendorName: "Auto Alert", title: "Auto Alert: Expensive Unused CRM Feel", quote: "Auto Alert initially strong upon introduction but experiences 'diminished returns' over time, feeling like an expensive, unused CRM.", explanation: "Auto Alert value diminishes after initial implementation period.", type: "warning", category: "equity-mining" },
  
  // Mastermind Deep Dive
  // Canada Drives Deep Dive - kept authentic quote
  { id: 477, vendorName: "Canada Drives", title: "Canada Drives: $120-$150 Per Lead", quote: "We use Canada Drives nearly exclusively. You need either well equipped subprime sales people or an AI CRM that does it all for them. Many customers are approval-focused rather than vehicle-focused. Leads are costly ($120-$150 per lead), demanding a high Gross Profit per unit for a positive ROI.", explanation: "Canada Drives works for subprime but costs $120-$150 per lead.", type: "warning", category: "lead-providers" },
  
  // Dynatron/Mastermind - see IDs 15, 359, 522 for authentic coverage
  
  // Assurant - see ID 636 for authentic quote
  
  // Ntiva Deep Dive
  { id: 480, vendorName: "Ntiva", title: "Ntiva: Good Support, Not Dealer-Specific", quote: "We use Ntiva for basic network support and IT. I won't say they understand dealers specifically but they support all of our devices and servers well. Customer service is good and timely.", explanation: "Ntiva provides reliable IT support with good service, not dealer-specialized.", type: "positive", category: "it-support" },
  
  // Field Effect Deep Dive
  { id: 481, vendorName: "Field Effect", title: "Field Effect: Security Scanning and Monitoring", quote: "We have a layered approach to the IT world with ComplyAuto for training and compliance, Ntiva for network, and Field Effect for security scanning and monitoring.", explanation: "Field Effect provides security scanning as part of layered IT strategy.", type: "positive", category: "it-support" },
  
  // OWL Consulting
  { id: 482, vendorName: "OWL Consulting", title: "OWL Consulting: Quality IT People", quote: "Check out OWL Consulting. Quality people.", explanation: "OWL Consulting recommended for quality IT personnel.", type: "positive", category: "it-support" },
  
  // OEM Programs - Additional Entries
  { id: 483, vendorName: "GM IMR", title: "GM IMR: SAVIs, iPads, Sticker Printers", quote: "GM IMR funds successfully utilized for purchasing SAVIs, iPads, and maintenance sticker printers, with success on overpower claims. A significant portion allocated to SFE enrollment yielded a return of over $300,000 for a $60,000 investment.", explanation: "GM IMR funds can be strategically used for equipment and SFE with massive ROI.", type: "positive", category: "marketing" },
  // OEM Programs - Unique entries only (removed duplicates with summarized language)
  { id: 484, vendorName: "Nissan DVB", title: "Nissan DVB: Restructured to 2 Tiers", quote: "Nissan DVB program restructured to two payout levels from three. Objectives are 'insane,' often requiring aggressive pricing and pushing to meet targets. Dealers penalized by the loss of the 110%+ tier.", explanation: "Nissan DVB restructure removes top tier and forces unprofitable behaviors.", type: "warning", category: "marketing" },
  { id: 489, vendorName: "Subaru SSLP", title: "Subaru SSLP: Increase Service Capacity", quote: "Subaru SSLP can serve as a 'crutch' to increase service capacity, capture service opportunities, and improve retention. Depreciation is sometimes split 50/50 between New Car and Service. Sales department benefits from an added RDR.", explanation: "Subaru loaner program builds service capacity with creative depreciation accounting.", type: "positive", category: "fixed-ops" },
  { id: 490, vendorName: "Subaru SSLP", title: "Subaru SSLP: Big Loss on Front End", quote: "Selling Subaru SSLP vehicles often results in a 'big loss on the front end.' Depreciation is typically charged to sales before the vehicle goes to CPO.", explanation: "Subaru loaner program creates front-end losses when vehicles transition to CPO.", type: "warning", category: "fixed-ops" },
  
  // Phone Systems & BDC - Authentic quotes
  { id: 494, vendorName: "CallRevu", title: "CallRevu: Expensive When Overused", quote: "Yes and it got expensive cause my advisors stopped answering calls and let CallRevu do it.", explanation: "CallRevu overflow can become expensive when advisors over-rely on it.", type: "warning", category: "call-management" },
  { id: 499, vendorName: "Volie", title: "Volie: 40 Appointments Daily", quote: "Service BDC using Volie - this drives approx 40 appointments a day, but many of them are inbound.", explanation: "Volie drives 40 daily service appointments with strong VoIP capabilities.", type: "positive", category: "call-management" },
  
  // Training - Authentic quotes
  { id: 509, vendorName: "Service Department Solutions", title: "Service Dept Solutions: Honda 172% Warranty", quote: "Recommend you take a look at Service Department Solutions... Process takes a little longer but highly recommend. We had used Armatus in the past - numbers weren't even close.", explanation: "Service Dept Solutions delivers major warranty rate increases with flat pricing.", type: "positive", category: "fixed-ops" },
  { id: 511, vendorName: "Tenex", title: "Tenex: Non-Dealer AI Training", quote: "Tenex is a non-dealer specific AI training company that shadows employees, researches software, trains on usage, and can build new tailored software.", explanation: "Tenex provides customized AI training through employee shadowing.", type: "positive", category: "training" },
  
  // Other Tools - Authentic quotes
  { id: 512, vendorName: "700 Credit", title: "700 Credit Bureau: $4 Per Bureau", quote: "700 credit is about $4/bureau. Maybe a $3-$4 surcharge. We also use NCC and end up around the same pricing.", explanation: "700 credit bureau runs about $4/bureau with similar pricing to NCC.", type: "positive", category: "accounting" },
  { id: 526, vendorName: "Kenect", title: "Kenect.Ai: Text and Voice AI", quote: "We use Kenect.Ai. They acquired our previous vendor Autolabs... They use text message AI for outbound reminders and prospecting and they provide voice AI for making inbound appts.", explanation: "Kenect.Ai provides text and voice AI for appointments and prospecting.", type: "positive", category: "ai-automation" },
  { id: 527, vendorName: "Kenect", title: "Kenect.Ai: Contact Info Accuracy Issues", quote: "Our biggest pain point was the inaccurate contact information but we have found that across multiple databases.", explanation: "Kenect.Ai has contact information accuracy problems across databases.", type: "warning", category: "ai-automation" },
  { id: 532, vendorName: "Precision Inventory", title: "Precision Inventory: Biggest Win in Years", quote: "If you have a Ford and or Lincoln franchise I would HIGHLY recommend checking out Precision Inventory. They can take over your inventory allocation and ordering process. It's not our biggest win this year, but it's been our biggest win the past couple of years!", explanation: "Precision Inventory found loophole for complete Ford/Lincoln inventory access.", type: "positive", category: "inventory" },
  { id: 533, vendorName: "Stealth", title: "Stealth: Shouting Deters After-Hours", quote: "We use stealth who monitors and shouts at anything off hours.", explanation: "Stealth provides active audio deterrent for lot security.", type: "positive", category: "security" },
  { id: 534, vendorName: "TVI Marketpro3", title: "TVI Marketpro3: Want to Look Into", quote: "Dealer wing is one I wanna look into and TVI Marketpro3.", explanation: "TVI Marketpro3 is being evaluated for fixed ops marketing.", type: "positive", category: "marketing" },
  { id: 535, vendorName: "Willowood Ventures", title: "Willowood Ventures: Too Good to Be True", quote: "Anyone used or heard of Willowood Ventures? They claim to guarantee 150 plus appts within a 7 day period. But I haven't seen the actual show rates and sell rates.", explanation: "Willowood Ventures' 150+ appointment guarantee raises red flags.", type: "warning", category: "marketing" },
  { id: 536, vendorName: "Wynns", title: "Wynns: Broke In and Stole Equipment", quote: "Be careful with Wynns products. We switched to 10mm products and they forcibly broke into our locked parts storage and stole their machines back after agreeing to credit us. They have ghosted us on the refund.", explanation: "Wynns allegedly committed break-in and theft after dealer switched vendors.", type: "warning", category: "service-products" },

  // === NEW ENTRIES FROM CIRCLES CHAT IMPORT (January 2026) ===
  
  // AI & Technology Tools - Wins
  { id: 600, vendorName: "Claude", title: "Claude Cowork: Macro on Steroids", quote: "You can deploy it in your desktop and ask it to organize everything, old ROs, etc. With Cowork you can teach Claude to perform any task for you and once it's taught, you just click a button and it will do it all. ANY TASK within your desktop. It's a MACRO on steroids!", explanation: "Claude Cowork agent enables powerful desktop task automation for any repetitive task.", type: "positive", category: "ai-automation" },
  { id: 601, vendorName: "Constellations", title: "Constellations: First AEO/GEO Product", quote: "Check out Constellations new SEO+AEO product. First I've seen that is now tackling Answer Engine Optimization, also known as GEO (Generative Engine Optimization). This is an exercise that more retailers should be looking at in my opinion.", explanation: "Constellations leads in Answer Engine Optimization for AI search visibility.", type: "positive", category: "marketing" },
  { id: 602, vendorName: "Daily.therundown.ai", title: "The Rundown: AI News Resource", quote: "news@daily.therundown.ai", explanation: "The Rundown AI newsletter is recommended for staying current on AI developments.", type: "positive", category: "training" },
  { id: 603, vendorName: "DriveCentric", title: "DriveCentric: Incredible Communication Visibility", quote: "The visibility on communication and follow up tasks is incredible. I also love that management can step in and respond in any conversation, and can even make it look like the salesman is still talking. Really easy to hop in and help if someone is stuck.", explanation: "DriveCentric offers seamless management oversight with visible communication tracking.", type: "positive", category: "dms-crm" },
  { id: 604, vendorName: "EOS", title: "EOS: Game Changer for Accountability", quote: "Had our focus day yesterday with leaders for our journey on EOS.. really eye catching that we have never really had a good operational system to keep us on track or accountable. Exciting! It's a great system. Has been largely integral to our success, particularly as things became a lot more challenging last year.", explanation: "EOS (Entrepreneurial Operating System) provides game-changing accountability and tracking.", type: "positive", category: "training" },
  { id: 605, vendorName: "Field Effect", title: "Field Effect: Layered Security Approach", quote: "We have a layered approach to the IT world with ComplyAuto for training and compliance, Ntiva for network, and Field Effect for security scanning and monitoring. Overall it has served us well.", explanation: "Field Effect provides security scanning as part of a comprehensive IT security strategy.", type: "positive", category: "security" },
  { id: 606, vendorName: "Google Ads", title: "Google Ads: 10% More Leads Than Organic", quote: "We're heavy on Google Ads. It generates about 10% more leads than organic. Leads gross way higher than 3rd party leads, also conversions are higher.", explanation: "Google Ads consistently delivers higher quality leads with better gross than third-party sources.", type: "positive", category: "marketing" },
  { id: 607, vendorName: "Google Sheets", title: "Google Sheets: Free Inventory Tracking", quote: "Yes, I've been using it in multiple stores for years. You can lock down cells and assign editing access to individuals. It also keeps a full audit log of what has been changed. Works well.", explanation: "Google Sheets is free and effective for tracking inventory progress with full audit logging.", type: "positive", category: "inventory" },
  { id: 608, vendorName: "GoTo", title: "GoTo: Phone System That Works Great", quote: "We are using GoTo and it works great.", explanation: "GoTo is a reliable phone system solution for dealerships.", type: "positive", category: "call-management" },
  { id: 609, vendorName: "Gubagoo", title: "Gubagoo: Best DR Tool on the Market", quote: "I recently switched to gubagoo for DR/chat/soft credit checks… it was a bit cumbersome to set up, but now that it's up and running I couldn't imagine there's a better tool on the market.", explanation: "Gubagoo is excellent for digital retailing despite initial setup complexity.", type: "positive", category: "digital-retailing" },
  { id: 610, vendorName: "Hamlin And Associates", title: "Hamlin: Works Well with GM IMR", quote: "We have been very successful with Hamlin And Associates mail. We are doing a big drop this month. One of the few IMR GM vendors that actually works well for us.", explanation: "Hamlin And Associates mailers deliver strong results with GM IMR funds.", type: "positive", category: "marketing" },
  { id: 611, vendorName: "Helion", title: "Helion: IT Provider Recommendation", quote: "Helion.", explanation: "Helion is recommended as an IT provider for dealerships.", type: "positive", category: "it-support" },
  { id: 612, vendorName: "Jonathan Mast", title: "Jonathan Mast: Easy AI Courses", quote: "Look up Jonathan Mast. He does courses that are very, very easy to follow. He keeps things current, too.", explanation: "Jonathan Mast offers accessible, up-to-date AI courses for entrepreneurs.", type: "positive", category: "training" },
  { id: 613, vendorName: "Matador", title: "Matador AI: 10 Cars/Month ROI", quote: "If I can get a combination of 10 cars or car sales from it each month It more than pencils out.", explanation: "Matador AI follow-up delivers ROI at 10+ car sales per month.", type: "positive", category: "ai-automation" },
  { id: 614, vendorName: "Netchex", title: "Netchex: Love the PTO Tracking", quote: "We use Netchex and I love it. Pros it tracks everyone's vacation/pto requests and balances.", explanation: "Netchex excels at vacation/PTO tracking for all employees.", type: "positive", category: "hr-payroll" },
  { id: 615, vendorName: "Ntiva", title: "Ntiva: Good and Timely IT Support", quote: "We use Ntiva for basic network support and IT. I won't say they understand dealers specifically but they support all of our devices and servers well. Customer service is good and timely.", explanation: "Ntiva provides reliable network support with good customer service.", type: "positive", category: "it-support" },
  { id: 616, vendorName: "OWL Consulting", title: "OWL Consulting: Quality IT People", quote: "Check out OWL Consulting. Quality people.", explanation: "OWL Consulting is recommended for quality IT consulting personnel.", type: "positive", category: "it-support" },
  { id: 617, vendorName: "Pam", title: "Pam AI: Great After-Hours Support", quote: "We use Pam for after hours and a back up if no one answers in a few stores. Both around 1k a month. It is integrated with our DMS and with Xtime. Pulls up the customers account via phone number. We use it to help with the easy stuff. Oil changes, maintenance, etc. has worked well.", explanation: "Pam AI handles after-hours calls with DMS and Xtime integration at $1K/month.", type: "positive", category: "ai-automation" },
  { id: 618, vendorName: "Paylocity", title: "Paylocity: Good After Setup", quote: "We switched to Paylocity in December we like it lots of set up.", explanation: "Paylocity is well-received after significant initial setup.", type: "positive", category: "hr-payroll" },
  { id: 619, vendorName: "Podium", title: "Podium Jerry: High Engagement AI", quote: "Podium's AI tool, Jerry, is loved for its text widget on websites, generating a ton of engagement. He handles the conversations very well.", explanation: "Podium's Jerry AI generates high engagement through text widget conversations.", type: "positive", category: "ai-automation" },
  { id: 620, vendorName: "Precision Inventory", title: "Precision IM: Biggest Win in Years", quote: "If you have a Ford and or Lincoln franchise I would HIGHLY recommend checking out Precision Inventory. They can take over your inventory allocation and ordering process from your GSM. It's not our biggest win this year, but it's been our biggest win the past couple of years!", explanation: "Precision Inventory takes over Ford/Lincoln ordering - a game-changer for inventory management.", type: "positive", category: "inventory" },
  { id: 621, vendorName: "Proton", title: "Proton: Great Relationship After Reynolds", quote: "Proton - great relationship, now owned by Reynolds.", explanation: "Proton maintained great relationships even after Reynolds acquisition.", type: "positive", category: "dms-crm" },
  { id: 622, vendorName: "PureCars", title: "Autominer: Clean Data Campaigns", quote: "We use Purecars/Autominer. Combines DMS/CRM and other data, cleans it including updating vehicle and address info. Then sends email and SMS messages depending on what your goals are.", explanation: "Autominer combines and cleans DMS/CRM data for targeted campaigns.", type: "positive", category: "marketing" },
  { id: 623, vendorName: "Shiftly", title: "Shiftly: Good Things Heard", quote: "Have heard good things about Shiftly.", explanation: "Shiftly has positive word-of-mouth for Facebook Marketplace automation.", type: "positive", category: "marketing" },
  { id: 624, vendorName: "SMedia", title: "SMedia: Social Media Activity", quote: "We use SMedia for a lot of our social activity.", explanation: "SMedia is used for managing social media marketing activities.", type: "positive", category: "marketing" },
  { id: 625, vendorName: "SmartPath", title: "SmartPath Sales: Runs Pretty Smooth", quote: "We've been on SmartPath Sales for about three years now and it runs pretty smooth. We use it for 100% of our retail deals, unless it's registered in a business name. Its very dependent on the sales staff being confident with the tool.", explanation: "SmartPath Sales works well for retail deals when staff are confident with the tool.", type: "positive", category: "digital-retailing" },
  { id: 626, vendorName: "UpdatePromise", title: "SmartPath Service: Great After Rough Start", quote: "Smartpath Service with UpdatePromise - It's much better than sales for sure. It was very rough but have since come a long way.", explanation: "SmartPath Service with UpdatePromise improved significantly after initial challenges.", type: "positive", category: "fixed-ops" },
  { id: 627, vendorName: "Snap On", title: "Snap On Scanner: Around $3000", quote: "We also have a Snap On scanner. Snap on Solus I think it's around $3000.", explanation: "Snap On Solus scanner is a quality diagnostic tool at $3000.", type: "positive", category: "diagnostics" },
  { id: 628, vendorName: "Stellantis", title: "Stellantis: Product Momentum Building", quote: "Just got our first Charger Sixpack and first Gladiator Sahara. We have experienced the same momentum. A lot of buzz around Stellantis products.", explanation: "New Stellantis products like Charger Sixpack and Gladiator are creating dealer excitement.", type: "positive", category: "marketing" },
  { id: 629, vendorName: "Tekion", title: "Tekion: Smooth Multi-Store DMS Migration", quote: "We moved two stores from CDK to Tekion in the last 4 years. Wasn't that painful though I hear it can be. Just need a team willing to forget all the crap CDK taught us and not dump crap processes into a shinny new DMS.", explanation: "Tekion transition requires forgetting old DMS inefficiencies.", type: "positive", category: "dms-crm" },
  { id: 630, vendorName: "Velocity Automotive", title: "Velocity: $125/Month Window Stickers", quote: "We use Velocity Automotive to run VINs and get window stickers for trade appraisals and bookouts. Expense is $125 per month.", explanation: "Velocity Automotive provides window sticker lookups at $125/month.", type: "positive", category: "diagnostics" },
  { id: 631, vendorName: "Voisentry", title: "Voisentry: Live Security Monitoring", quote: "We use Voisentry for live monitoring.", explanation: "Voisentry provides live security monitoring services.", type: "positive", category: "security" },
  { id: 632, vendorName: "VINCUE", title: "VINCUE: Nobody Wants to Go Back", quote: "We switched to VINCUE last fall and love it. So far nobody across three rooftops is asking to go back. Steep learning curve with the switch and we are all still learning every day!", explanation: "VINCUE has strong adoption across multiple rooftops despite learning curve.", type: "positive", category: "inventory" },
  { id: 633, vendorName: "vAuto", title: "V-Auto: Huge Role in Used Car Growth", quote: "Last year we did this with V-Auto, and set up weekly meetings with them to evaluate our inventory and pricing strategy. That one change played a huge role in our used car growth.", explanation: "V-Auto weekly meetings significantly contributed to used car growth.", type: "positive", category: "inventory" },
  { id: 634, vendorName: "Windowstickerlookup", title: "Window Sticker Lookup: $8 for Lexus", quote: "Most are available in this site: https://windowstickerlookup.com. A Lexus sticker might cost $8.", explanation: "Window Sticker Lookup offers affordable sticker retrieval starting at $8.", type: "positive", category: "diagnostics" },
  
  // Training & Resources - Wins
  { id: 635, vendorName: "AI Prompts for Entrepreneurs", title: "AI Prompts FB Group: Good Starting Point", quote: "There's a Facebook group called AI Prompts for Entrepreneurs. That's a good place to get started with questions for your prompting on your project.", explanation: "Facebook group for AI prompt guidance and learning.", type: "positive", category: "training" },
  { id: 636, vendorName: "Assurant", title: "Assurant: Balanced Service Advisor Training", quote: "We have been using Assurant Dealer Services training for our service advisors. It's been very positive for us. They strike the right balance that everyone above expressed concern about. I highly recommend them.", explanation: "Assurant delivers balanced, effective service advisor training.", type: "positive", category: "training" },
  { id: 637, vendorName: "Ethos Group", title: "Ethos Group: Love Their Service Process", quote: "I absolutely love the Ethos service process. We've used Chris Collins and Ethos Group successfully over the years.", explanation: "Ethos Group provides excellent service process methodology.", type: "positive", category: "training" },
  { id: 638, vendorName: "RevDojo", title: "RevDojo: Sales Training Under Consideration", quote: "We are looking at sales training companies - I'm going to checkout RevDojo with Kyle Disher.", explanation: "RevDojo with Kyle Disher is being evaluated for sales training.", type: "positive", category: "training" },
  { id: 639, vendorName: "Sellchology", title: "Sellchology: Jonathan Dawson Training", quote: "Also Jonathan Dawson Sellchology and Proactive Training Solutions.", explanation: "Jonathan Dawson's Sellchology is a sales training option under consideration.", type: "positive", category: "training" },
  { id: 640, vendorName: "Working Genius", title: "Working Genius: Phenomenal Book", quote: "Patrick Lencioni's Working Genius book is absolutely phenomenal - an amazing read for those who haven't already for executive teams.", explanation: "Patrick Lencioni's Working Genius is essential reading for executive teams.", type: "positive", category: "training" },
  
  // AI & Technology - Warnings
  { id: 650, vendorName: "Autofi", title: "Autofi: Did Not Last Long", quote: "2 of our rooftops were on Autofi, needless to say, it did not last long. I wasn't impressed. They are better at marketing than they are at car biz.", explanation: "Autofi failed to deliver despite strong marketing presence.", type: "warning", category: "digital-retailing" },
  { id: 651, vendorName: "Blink", title: "Blink: Haven't Paid Since June", quote: "Anyone having trouble collecting from Blink? They haven't paid us since June for our charger and the monies they collect 'for us'??? All we get are standard emails without being able to speak to a human.", explanation: "Blink has severe payment collection issues with no human support available.", type: "warning", category: "it-support" },
  { id: 652, vendorName: "Cars.com", title: "Cars.com: Poor ROI and Reporting", quote: "Cars has had the worst ROI. I have been on and off but they are charging too much for the amount of leads they bring. We're actually looking at dropping cars because the ROI isn't there. It's just not making sense anymore.", explanation: "Cars.com criticized for poor ROI and excessive pricing for lead volume.", type: "warning", category: "lead-providers" },
  { id: 653, vendorName: "CDK", title: "CDK: Decades of Learned Inefficiencies", quote: "The amount of learned inefficiencies that come with decades of CDK is very large. It's a big opportunity for us to rip the Band-Aid off and become a more efficient store.", explanation: "Long-term CDK use creates hidden process inefficiencies.", type: "warning", category: "dms-crm" },
  { id: 654, vendorName: "DealerSocket", title: "DealerSocket: Won't Release Your Data", quote: "Only issue was with DealerSocket not wanting to give us our data which was a pain.", explanation: "DealerSocket creates challenges with data portability during CRM transitions.", type: "warning", category: "dms-crm" },
  { id: 655, vendorName: "Demand Gen", title: "Google Demand Gen: Waste vs Search/PMax", quote: "Demand Gen was a waste in comparison to Search and PMax campaigns.", explanation: "Google Demand Gen underperforms compared to Search and PMax.", type: "warning", category: "marketing" },
  { id: 656, vendorName: "DriveAI", title: "DriveAI: Rebranded GoHighLevel", quote: "Only recently discovered that driveai and automotiveaccelerator are literally just rebranded gohighlevel. Wild considering what they're charging dealers and how they are just reselling something anyone can buy for 299/month.", explanation: "DriveAI and AutomotiveAccelerator are just rebranded GoHighLevel at inflated prices.", type: "warning", category: "marketing" },
  { id: 657, vendorName: "Edmunds", title: "Edmunds: Cut Without Impact", quote: "We cut Edmunds. Haven't seen any impact in business.", explanation: "Cutting Edmunds had no noticeable negative impact on business.", type: "warning", category: "lead-providers" },
  { id: 658, vendorName: "Google Ads", title: "Google PMAX for Brand: 99% Service Calls", quote: "We got a list of all the click to calls and found they were 99% service department appointments / visits.", explanation: "PMAX for brand campaigns drives service calls, not sales leads.", type: "warning", category: "marketing" },
  { id: 659, vendorName: "Kijiji", title: "Kijiji: Horrendously Expensive, Low Return", quote: "Left them 3 years ago. And haven't seen any impact in business. They're horrendously expensive and little return. Leads not as qualified.", explanation: "Kijiji is expensive with poor lead quality - Facebook Marketplace took its market share.", type: "warning", category: "lead-providers" },
  { id: 660, vendorName: "Mastermind", title: "Mastermind: Expensive, Data Lock-in", quote: "Mastermind is not cheap. When we cancelled, all of our data mining, marketing etc went with it. We had no real way of knowing who/what/when got marketing from us.", explanation: "Mastermind is expensive and creates data dependency on cancellation.", type: "warning", category: "equity-mining" },
  { id: 661, vendorName: "Meta", title: "Meta Ads: Never Worked Well", quote: "Meta has never worked well for us.", explanation: "Meta advertising yields inconsistent results for some dealerships.", type: "warning", category: "marketing" },
  { id: 662, vendorName: "Mudd", title: "Mudd Mailers: Minimal Success in Boston", quote: "We've done the same mud mailer in metro Boston and have had very minimal success. It didn't positive ROI for me.", explanation: "Mudd mailers fail in some metro markets - results are highly regional.", type: "warning", category: "marketing" },
  { id: 663, vendorName: "Trade Pending", title: "Trade Pending: Very Vanilla", quote: "We use trade pending and want to change. Not happy. Very vanilla.", explanation: "Trade Pending lacks differentiation and innovation.", type: "warning", category: "digital-retailing" },
  { id: 664, vendorName: "Tuscany", title: "Tuscany: Terrible Upfitting Experience", quote: "Terrible experience with Tuscany.", explanation: "Tuscany upfitting has delivered terrible customer experiences.", type: "warning", category: "inventory" },
  
  // Business Practices - Warnings
  { id: 670, vendorName: "Andy Elliott", title: "Andy Elliott: Not for Green Peas", quote: "The last person I would pay for though is Andy. His platform is more for seasoned guys/gals than the green peas we're getting right now. I know about all the crimes he committed when he was at the store level and all that yelling and macho stuff doesn't move me.", explanation: "Andy Elliott's style is for experienced salespeople, not new hires.", type: "warning", category: "training" },
  { id: 671, vendorName: "Capital One", title: "Cap One Mailers: Mixed Results at $17K", quote: "We spent $5,000 on cap one mailers in November. I can attribute 2 sales to them. We have done two cap one sales events one in December and one in January that have a guarantee 10 sales each for $17,000 each. So far only one deal from them.", explanation: "Capital One mailers and events have high costs with inconsistent returns.", type: "warning", category: "marketing" },
  { id: 672, vendorName: "Chris Collins", title: "Chris Collins: Increased Gross, Declining CP RO", quote: "We used Collins and dropped them. Our gross went way up but our CP RO Count was declining. They are very aggressive on pricing strategy and push the flushes really hard. I felt their service drive experience was very customer centric but not their selling philosophy.", explanation: "Chris Collins increases short-term gross but can hurt long-term CP RO count.", type: "warning", category: "training" },
  { id: 673, vendorName: "Amazon", title: "Amazon Car Shopping: Hyundai Experiment Failed", quote: "The Hyundai experiment has proven that people like shopping on Amazon, just not for cars.", explanation: "Amazon is not a compelling car shopping marketplace based on Hyundai experiment.", type: "warning", category: "marketing" },
  { id: 674, vendorName: "Stellantis", title: "Stellantis Parts Statement: Hard to Understand", quote: "Anyone else feel like you are bombarded with changes and such on your parts statement from Stellantis advertising and just tendon fees and they make it really hard to understand?", explanation: "Stellantis parts statements are confusing with frequent changes and hidden fees.", type: "warning", category: "accounting" },
  { id: 675, vendorName: "Toyota", title: "Toyota: Lower Production, Price Increases", quote: "What's thoughts on Toyota stating lower production and raising prices potential 3 times this year? As long as inventory is allocated fairly and allows us to hit objectives......all good. High demand and low stock on the ground should translate to higher gross profit opportunities.", explanation: "Toyota production cuts and price increases create both challenges and margin opportunities.", type: "warning", category: "marketing" },
  { id: 676, vendorName: "Roush", title: "Roush: Some Luck with Upfitting", quote: "We've had ok luck with Roush. We dangled a carrot that we would buy some vehicles and they gave us some f150s that weren't upfitted yet.", explanation: "Roush upfitting requires negotiation to get unallocated vehicles.", type: "positive", category: "inventory" },
];


const WinCard = ({ 
  entry, 
  isLocked,
  showVendorNames,
  isFullAccess,
  isAuthenticated,
  onShareCard,
  onUpgradeClick
}: { 
  entry: VendorEntry; 
  isLocked: boolean;
  showVendorNames: boolean;
  isFullAccess: boolean;
  isAuthenticated: boolean;
  onShareCard?: (entry: VendorEntry) => void;
  onUpgradeClick?: () => void;
}) => {
  const getTypeStyles = () => {
    switch (entry.type) {
      case "warning":
        return {
          border: "border-destructive/30 hover:border-destructive/50",
          bg: "bg-gradient-to-br from-destructive/5 via-card to-card",
          accent: "bg-destructive",
          badge: "bg-destructive/10 text-destructive",
          icon: <AlertTriangle className="h-3 w-3" />,
          label: "Warning"
        };
      case "positive":
        return {
          border: "border-green-500/30 hover:border-green-500/50",
          bg: "bg-gradient-to-br from-green-500/5 via-card to-card",
          accent: "bg-green-500",
          badge: "bg-green-500/10 text-green-600",
          icon: <ThumbsUp className="h-3 w-3" />,
          label: "Recommended"
        };
      default:
        return {
          border: "border-primary/30 hover:border-primary/50",
          bg: "bg-gradient-to-br from-primary/5 via-card to-card",
          accent: "bg-primary",
          badge: "bg-primary/10 text-primary",
          icon: <Lightbulb className="h-3 w-3" />,
          label: "Strategy"
        };
    }
  };
  
  const styles = getTypeStyles();
  
  return (
    <div className={`relative overflow-hidden border rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-lg transition-all duration-300 group h-full flex flex-col ${styles.border} ${styles.bg}`}>
      {/* Left accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.accent}`} />
      
      {/* Header - Mobile optimized with stacked layout */}
      <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
        <Quote className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          {isLocked && (
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-muted text-muted-foreground">
              <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="hidden xs:inline">Pro Only</span>
              <span className="xs:hidden">Pro</span>
            </div>
          )}
          <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${styles.badge}`}>
            {styles.icon}
            {styles.label}
          </div>
        </div>
      </div>
      
      {/* Quote - Heavily redacted for locked, full quote for unlocked */}
      <div className="flex-1">
        {isLocked ? (
          <div className="relative h-full min-h-[120px]">
            {/* Heavily redacted quote */}
            <p className="text-foreground/80 text-sm sm:text-sm leading-relaxed line-clamp-4 sm:line-clamp-none blur-[6px] select-none pointer-events-none">
              "{entry.quote}"
            </p>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-2 blur-[4px] select-none">
              — Circles Member
            </p>
            
            {/* Upgrade CTA overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background/80 via-background/40 to-transparent">
              <button 
                onClick={() => {
                  if (isAuthenticated && onUpgradeClick) {
                    // For authenticated users, open upgrade modal
                    onUpgradeClick();
                  } else {
                    // For anonymous users, scroll to tiers section
                    const tiersSection = document.getElementById('tiers-section');
                    if (tiersSection) {
                      const offset = 100;
                      const elementPosition = tiersSection.getBoundingClientRect().top + window.pageYOffset;
                      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
                    }
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold text-sm shadow-lg hover:shadow-xl transition-all cursor-pointer"
              >
                <Crown className="h-4 w-4" />
                <span>{isAuthenticated ? 'Upgrade to Pro' : 'Join Pro for Access'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <p className="text-foreground/80 text-sm sm:text-sm leading-relaxed line-clamp-4 sm:line-clamp-none">
              "{showVendorNames ? entry.quote : blurVendorNames(entry.quote)}"
            </p>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-2">
              — Circles Member
            </p>
          </div>
        )}
      </div>
      
      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-3 sm:my-4" />
      
      {/* Footer - Title with vendor names blurred for anonymous, visible for community+  */}
      <div className="space-y-1.5 sm:space-y-2 mt-auto">
        <h3 className="font-bold text-foreground text-sm sm:text-base line-clamp-2">
          {showVendorNames ? entry.title : blurVendorNames(entry.title)}
        </h3>
        {isFullAccess && !isLocked ? (
          <>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              {entry.explanation}
            </p>
            <div className="flex items-center justify-end pt-0.5 sm:pt-1">
              <ShareButtons 
                quote={entry.quote}
                type={entry.type}
                onDownloadCard={() => onShareCard?.(entry)}
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">
            Join Pro to see full analysis
          </p>
        )}
      </div>
    </div>
  );
};

// Vendor Carousel Component
interface VendorCarouselProps {
  entries: VendorEntry[];
  accessLevel: ReturnType<typeof getAccessLevel>;
  userTier: string;
  isAuthenticated: boolean;
  cardRefs: React.MutableRefObject<{ [key: number]: HTMLDivElement | null }>;
  trackShare: (id: number) => void;
  setSelectedCardForShare: (entry: VendorEntry | null) => void;
  showTeaserCard: boolean;
  remainingCount: number;
  setShowUpgradeModal: (show: boolean) => void;
}

const VendorCarousel = ({
  entries,
  accessLevel,
  userTier,
  isAuthenticated,
  cardRefs,
  trackShare,
  setSelectedCardForShare,
  showTeaserCard,
  remainingCount,
  setShowUpgradeModal,
}: VendorCarouselProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true, 
    align: 'start',
    slidesToScroll: 1,
  });
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const scrollPrev = React.useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = React.useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = React.useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  React.useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="relative">
      {/* Carousel Container */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4">
          {entries.map((entry) => {
            const isWarning = entry.type === "warning";
            const isLocked = !accessLevel.unlimitedAccess && isWarning;
            // Clean tier model: anonymous = blur vendors, community+ = show vendors
            const showVendorNamesForCard = accessLevel.showVendorNames && !isLocked;

            return (
              <div 
                key={entry.id} 
                ref={(el) => { cardRefs.current[entry.id] = el; }}
                className="flex-none w-[320px] sm:w-[380px] lg:w-[420px] h-[280px] sm:h-[320px] lg:h-[340px]"
              >
                <WinCard 
                  entry={entry} 
                  isLocked={isLocked}
                  showVendorNames={showVendorNamesForCard}
                  isFullAccess={accessLevel.unlimitedAccess}
                  isAuthenticated={isAuthenticated}
                  onShareCard={(e) => {
                    if (typeof e.id === 'number') trackShare(e.id);
                    setSelectedCardForShare(e);
                  }}
                  onUpgradeClick={() => setShowUpgradeModal(true)}
                />
              </div>
            );
          })}
          
          {/* Teaser card */}
          {showTeaserCard && (
            <div className="flex-none w-[320px] sm:w-[380px] lg:w-[420px] h-[280px] sm:h-[320px] lg:h-[340px]">
              <div className="relative overflow-hidden border rounded-2xl p-6 shadow-sm bg-gradient-to-br from-muted/50 via-card to-card border-border/50 flex flex-col items-center justify-center h-full">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <div className="relative z-10 text-center">
                  <div className="p-3 rounded-full bg-yellow-500/20 mx-auto mb-3 w-fit">
                    <Lock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <p className="font-bold text-foreground text-lg mb-1">
                    +{remainingCount} more reviews
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Unlock all vendor intel with Pro
                  </p>
                  <button 
                    onClick={() => {
                      if (isAuthenticated) {
                        setShowUpgradeModal(true);
                      } else {
                        // Scroll to tiers section with offset
                        const tiersSection = document.getElementById('tiers-section');
                        if (tiersSection) {
                          const offset = 100;
                          const elementPosition = tiersSection.getBoundingClientRect().top + window.pageYOffset;
                          window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
                        }
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold text-sm shadow-lg hover:shadow-xl transition-all cursor-pointer mx-auto"
                  >
                    <Crown className="h-4 w-4" />
                    <span>{isAuthenticated ? 'Upgrade to Pro' : 'Join Pro'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Navigation Arrows */}
      <button
        onClick={scrollPrev}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 p-2 rounded-full bg-background/90 border border-border shadow-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canScrollPrev && entries.length <= 1}
      >
        <ChevronLeft className="h-5 w-5 text-foreground" />
      </button>
      <button
        onClick={scrollNext}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 p-2 rounded-full bg-background/90 border border-border shadow-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canScrollNext && entries.length <= 1}
      >
        <ChevronRight className="h-5 w-5 text-foreground" />
      </button>
    </div>
  );
};

const WinsWarnings = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [emailUnlocked, setEmailUnlocked] = useState(false);
  const [selectedCardForShare, setSelectedCardForShare] = useState<VendorEntry | null>(null);
  const [referralBonusEntries, setReferralBonusEntries] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const cardRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Scroll to top visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Get user tier from Airtable hook (still needed for access control)
  const { userTier, isAuthenticated } = useAirtableReviews();
  
  // Fetch vendor reviews from Supabase with fallback to hardcoded data
  const { reviews: supabaseReviews, isLoading: reviewsLoading } = useVendorReviews();
  
  // Use Supabase data if available, otherwise fall back to hardcoded data
  const vendorDataSource = supabaseReviews.length > 0 ? supabaseReviews : vendorData;
  const isLoading = reviewsLoading && supabaseReviews.length === 0;
  
  // Get access level based on user tier
  const accessLevel = getAccessLevel(userTier);
  const isProUser = accessLevel.unlimitedAccess;

  // Referral tracking
  const { referralCode, referralCount, bonusEntries, requiredReferrals } = useReferralTracking();

  // Trending entries tracking (also provides viewStats for sorting)
  const { trendingEntries, trackView, trackShare, viewStats } = useTrendingEntries(vendorDataSource);

  // Update referral bonus entries when bonusEntries changes
  useEffect(() => {
    setReferralBonusEntries(bonusEntries);
  }, [bonusEntries]);

  // Check if user previously unlocked via email
  useEffect(() => {
    const unlocked = localStorage.getItem("wins_email_unlocked") === "true";
    if (unlocked) {
      setEmailUnlocked(true);
    }
  }, []);

  // Extract unique vendor names for autocomplete suggestions
  const allVendorNames = useMemo(() => {
    const names = new Set<string>();
    vendorNamesToBlur.forEach(name => names.add(name));
    return Array.from(names).sort();
  }, []);

  // Filter suggestions based on search query
  const searchSuggestions = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    return allVendorNames
      .filter(name => name.toLowerCase().includes(query))
      .slice(0, 5);
  }, [searchQuery, allVendorNames]);

  // Extract trending topics from quote content (not vendor names)
  const trendingTopics = useMemo(() => {
    // Define topic keywords to look for in quotes (industry terms, not vendor names)
    const topicKeywords = [
      { term: "AI", aliases: ["AI", "artificial intelligence", "AI-powered"] },
      { term: "Voice AI", aliases: ["voice ai", "ai voice", "voice assistant", "voice bot"] },
      { term: "BDC", aliases: ["bdc", "business development center"] },
      { term: "Equity Mining", aliases: ["equity mining", "equity tool"] },
      { term: "Digital Retailing", aliases: ["digital retailing", "dr tool", "online retailing"] },
      { term: "Reconditioning", aliases: ["recon", "reconditioning"] },
      { term: "Service Drive", aliases: ["service drive", "service lane"] },
      { term: "Fixed Ops", aliases: ["fixed ops", "fixed operations"] },
      { term: "Warranty", aliases: ["warranty", "warranty claims"] },
      { term: "Training", aliases: ["training", "coaching"] },
      { term: "Integration", aliases: ["integration", "integrates", "integrations"] },
      { term: "Pricing", aliases: ["pricing", "markup", "labor rate"] },
      { term: "ROI", aliases: ["roi", "return on investment"] },
      { term: "Leads", aliases: ["leads", "lead quality", "lead source"] },
      { term: "Chat", aliases: ["chat", "chatbot", "live chat"] },
      { term: "CRM", aliases: ["crm", "customer relationship"] },
      { term: "DMS", aliases: ["dms", "dealer management"] },
      { term: "Scheduling", aliases: ["scheduling", "appointments", "appointment booking"] },
      { term: "Trade-in", aliases: ["trade-in", "trade appraisal", "appraisal"] },
      { term: "After-Hours", aliases: ["after-hours", "after hours", "overflow"] },
    ];

    // Count occurrences of each topic across all quotes
    const topicCounts: { [key: string]: number } = {};
    
    vendorDataSource.forEach(entry => {
      const quoteText = (entry.quote + " " + entry.explanation).toLowerCase();
      
      topicKeywords.forEach(topic => {
        const hasMatch = topic.aliases.some(alias => quoteText.includes(alias.toLowerCase()));
        if (hasMatch) {
          topicCounts[topic.term] = (topicCounts[topic.term] || 0) + 1;
        }
      });
    });

    // Sort by count and return top 8
    return Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([term, count]) => ({ term, count }));
  }, [vendorDataSource]);

  // All users can search and see all results (but with access restrictions)
  // Sort by engagement (views + shares*3) with warnings first for loss aversion
  const filteredData = useMemo(() => {
    return vendorDataSource
      .filter(entry => {
        const matchesCategory = selectedCategory === "all" || entry.category === selectedCategory;
        if (searchQuery === "") return matchesCategory;
        
        const query = searchQuery.toLowerCase();
        // Primary match: vendorName (the vendor being reviewed)
        const matchesVendorName = entry.vendorName?.toLowerCase().includes(query);
        // Secondary: title match
        const matchesTitle = entry.title.toLowerCase().includes(query);
        // Tertiary: quote and explanation content
        const matchesQuote = entry.quote?.toLowerCase().includes(query);
        const matchesExplanation = entry.explanation?.toLowerCase().includes(query);
        
        return matchesCategory && (matchesVendorName || matchesTitle || matchesQuote || matchesExplanation);
      })
      .map(entry => ({
        ...entry,
        engagementScore: (viewStats[entry.id]?.views || 0) + (viewStats[entry.id]?.shares || 0) * 3,
      }))
      .sort((a, b) => {
        // Primary: warnings first (loss aversion)
        if (a.type === "warning" && b.type === "positive") return -1;
        if (a.type === "positive" && b.type === "warning") return 1;
        // Secondary: engagement score (higher = better)
        return b.engagementScore - a.engagementScore;
      });
  }, [vendorDataSource, selectedCategory, searchQuery, viewStats]);
  
  const hiddenResultsCount = 0; // No longer hiding results count

  // For non-Pro users, warnings are hidden so adjust counts accordingly
  const visibleWarningCount = accessLevel.unlimitedAccess ? filteredData.filter(e => e.type === "warning").length : 0;
  const positiveCount = filteredData.filter(e => e.type === "positive").length;
  const lockedWarningCount = !accessLevel.unlimitedAccess ? filteredData.filter(e => e.type === "warning").length : 0;
  
  // Total warnings across ALL data (not filtered) - used for upgrade CTAs
  const totalWarningCount = vendorDataSource.filter(e => e.type === "warning").length;

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);

  // Calculate counts per category for badges
  const categoryCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    counts["all"] = vendorDataSource.length;
    categories.forEach(cat => {
      if (cat.id !== "all") {
        counts[cat.id] = vendorDataSource.filter(entry => entry.category === cat.id).length;
      }
    });
    return counts;
  }, [vendorDataSource]);

  // Get unique vendors within selected category for vendor chips
  const vendorsInCategory = useMemo(() => {
    if (selectedCategory === "all") return [];
    
    const vendorCounts: { [key: string]: number } = {};
    vendorDataSource
      .filter(entry => entry.category === selectedCategory)
      .forEach(entry => {
        if (entry.vendorName) {
          vendorCounts[entry.vendorName] = (vendorCounts[entry.vendorName] || 0) + 1;
        }
      });
    
    // Sort by review count (descending) and return vendor names with counts
    return Object.entries(vendorCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [vendorDataSource, selectedCategory]);

  // Handle search submission
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setHasSearched(true);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Vendor Reviews from CDG Circles',
      text: 'Real vendor reviews from verified auto dealers. See what dealers are saying about your vendors.',
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <>
      <Helmet>
        <title>Vendor Reviews | CDG Circles - Real Dealer Insights</title>
        <meta name="description" content="Discover which automotive vendors work and which to avoid. Real reviews and strategies from verified dealers in CDG Circles." />
        <meta property="og:title" content="Vendor Reviews | CDG Circles" />
        <meta property="og:description" content="Real vendor reviews and proven strategies from verified auto dealers." />
        <meta property="og:image" content="/og-retreat-hero.jpg" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Link to="/" className="flex items-center gap-2">
                  <img src={cdgCirclesLogo} alt="CDG Circles" className="h-8" />
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
                {!isAuthenticated && !isLoading && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/auth')}
                    className="gap-2"
                  >
                    <User className="h-4 w-4" />
                    Sign In
                  </Button>
                )}
                {isAuthenticated && !isProUser && !isLoading && (
                  <Button 
                    variant="yellow" 
                    size="sm"
                    onClick={() => window.open('https://billing.stripe.com/p/login/cN23dQ1g35Tsd3ibII', '_blank')}
                    className="gap-2 font-bold"
                  >
                    <Crown className="h-4 w-4" />
                    Upgrade
                  </Button>
                )}
                {isAuthenticated && !isLoading && (
                  <>
                    <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-muted text-[10px] sm:text-xs font-medium text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="capitalize">{userTier}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        navigate('/vendors');
                      }}
                      className="gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="hidden sm:inline">Sign Out</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Hero - Search-First Design */}
        <section className="py-16 sm:py-24 bg-gradient-to-b from-muted/50 to-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center">
              {/* Pulsating Updated Daily Badge */}
              <div className="flex justify-center mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-400">Updated Daily</span>
                </div>
              </div>
              
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-foreground mb-4">
                What are dealers saying about{" "}
                <span className="text-primary">your vendor</span>?
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Search any automotive vendor to see {vendorDataSource.length}+ real reviews from verified Circles members.
              </p>
              
              {/* Hero Search Bar - Available to all users */}
              <div className="relative max-w-2xl mx-auto mb-8">
                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search any vendor..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-14 pr-14 py-7 text-lg rounded-2xl border-2 border-border focus:border-primary shadow-lg"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setHasSearched(false);
                      }}
                      className="absolute right-5 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                
                {/* Trending Topics - Horizontally scrollable on mobile */}
                {!searchQuery && trendingTopics.length > 0 && (
                  <div className="relative mt-4">
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 px-1 -mx-1 sm:flex-wrap sm:justify-center sm:overflow-visible">
                      <span className="text-xs text-muted-foreground mr-1 whitespace-nowrap shrink-0">Trending:</span>
                      {trendingTopics.slice(0, 6).map(({ term, count }) => (
                        <button
                          key={term}
                          onClick={() => handleSearch(term)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted border border-border hover:border-primary/30 text-xs font-medium text-foreground transition-all whitespace-nowrap shrink-0"
                        >
                          {term}
                          <span className="text-muted-foreground">({count})</span>
                        </button>
                      ))}
                    </div>
                    {/* Fade edges on mobile */}
                    <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
                  </div>
                )}
              </div>
              
              {/* Quick Stats - Mobile optimized grid */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm">
                <div className="flex flex-col items-center p-3 rounded-xl bg-card border border-border sm:bg-transparent sm:border-0 sm:p-0 sm:flex-row sm:gap-1.5">
                  <span className="text-2xl sm:text-base font-bold text-foreground">{vendorDataSource.length}</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">reviews</span>
                </div>
                <span className="w-px h-8 bg-border hidden sm:block" />
                <div className="flex flex-col items-center p-3 rounded-xl bg-card border border-border sm:bg-transparent sm:border-0 sm:p-0 sm:flex-row sm:gap-1.5">
                  <span className="text-2xl sm:text-base font-bold text-foreground">{new Set(vendorDataSource.map(e => e.vendorName)).size}</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">vendors</span>
                </div>
                <span className="w-px h-8 bg-border hidden sm:block" />
                <div className="flex flex-col items-center p-3 rounded-xl bg-card border border-border sm:bg-transparent sm:border-0 sm:p-0 sm:flex-row sm:gap-1.5">
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="text-2xl sm:text-base font-bold text-foreground">{vendorDataSource.filter(e => e.type === "positive").length}</span>
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground">positive</span>
                </div>
                <span className="w-px h-8 bg-border hidden sm:block" />
                <div className="flex flex-col items-center p-3 rounded-xl bg-card border border-border sm:bg-transparent sm:border-0 sm:p-0 sm:flex-row sm:gap-1.5">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-2xl sm:text-base font-bold text-foreground">{vendorDataSource.filter(e => e.type === "warning").length}</span>
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground">warnings</span>
                </div>
              </div>
              
              {/* Methodology Cards - Desktop: hover tooltips, Mobile: tap popovers */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-8 text-xs">
                {/* Real Talk */}
                <div className="hidden sm:block">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border cursor-help transition-colors hover:border-primary/50">
                          <MessageCircle className="h-4 w-4 text-primary" />
                          <span className="font-medium text-foreground">Real Talk</span>
                          <span className="text-muted-foreground">· Private discussions</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p>Every review is sourced from organic conversations within our private dealer community—not solicited or curated.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="sm:hidden inline-flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border cursor-pointer active:border-primary/50">
                      <MessageCircle className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">Real Talk</span>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" className="max-w-xs text-sm">
                    <p>Every review is sourced from organic conversations within our private dealer community—not solicited or curated.</p>
                  </PopoverContent>
                </Popover>

                {/* Unedited */}
                <div className="hidden sm:block">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border cursor-help transition-colors hover:border-orange-500/50">
                          <Zap className="h-4 w-4 text-orange-500" />
                          <span className="font-medium text-foreground">Unedited</span>
                          <span className="text-muted-foreground">· No paid placements</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p>Raw and unfiltered. No vendor can pay to remove reviews. What you see is what dealers actually said.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="sm:hidden inline-flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border cursor-pointer active:border-orange-500/50">
                      <Zap className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-foreground">Unedited</span>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" className="max-w-xs text-sm">
                    <p>Raw and unfiltered. No vendor can pay to remove reviews. What you see is what dealers actually said.</p>
                  </PopoverContent>
                </Popover>

                {/* Verified */}
                <div className="hidden sm:block">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border cursor-help transition-colors hover:border-green-500/50">
                          <ShieldCheck className="h-4 w-4 text-green-500" />
                          <span className="font-medium text-foreground">Verified</span>
                          <span className="text-muted-foreground">· Circles members only</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p>Every review comes from a verified Circles member—real dealers running real rooftops.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="sm:hidden inline-flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border cursor-pointer active:border-green-500/50">
                      <ShieldCheck className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-foreground">Verified</span>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" className="max-w-xs text-sm">
                    <p>Every review comes from a verified Circles member—real dealers running real rooftops.</p>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </section>
        
        {/* Search Results Summary - Shows when user has searched */}
        {hasSearched && searchQuery && (
          <section className="py-8 border-b border-border bg-card">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-2xl font-black text-foreground mb-2">
                      Results for{" "}
                      <span className="text-primary">
                        "{searchQuery}"
                      </span>
                      {!accessLevel.showVendorNames && <Lock className="inline h-4 w-4 ml-2 text-muted-foreground" />}
                    </h2>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-semibold">{filteredData.length} dealer reviews found</span>
                      {positiveCount > 0 && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className="flex items-center gap-1 text-green-600">
                            <ThumbsUp className="h-3 w-3" /> {positiveCount} recommended
                          </span>
                        </>
                      )}
                      {lockedWarningCount > 0 && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Lock className="h-3 w-3" /> {lockedWarningCount} warnings
                        </span>
                      )}
                      {visibleWarningCount > 0 && (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" /> {visibleWarningCount} warnings
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {!accessLevel.unlimitedAccess && filteredData.length > 0 && (
                    <Button 
                      variant="yellow" 
                      size="lg"
                      onClick={() => navigate(isAuthenticated ? '/#pricing' : '/auth')}
                      className="gap-2 font-bold shrink-0"
                    >
                      <Crown className="h-4 w-4" />
                      {isAuthenticated ? 'Unlock Full Reviews' : 'Join Circles to See More'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}


        {/* Category Filters - Sticky */}
        <section className="sticky top-16 z-40 bg-background border-b border-border py-4">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Category dropdown for mobile */}
              <div className="sm:hidden relative w-full">
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    {selectedCategoryData?.icon} {selectedCategoryData?.label}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                </Button>
                {showCategoryDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setSearchQuery("");
                          setShowCategoryDropdown(false);
                          setHasSearched(true);
                        }}
                        className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-muted transition-colors ${
                          selectedCategory === cat.id ? 'bg-primary/10 text-primary' : ''
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span className="flex-1">{cat.label}</span>
                        <span className="text-xs text-muted-foreground">{categoryCounts[cat.id] || 0}</span>
                        {selectedCategory === cat.id && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Category pills for tablet/desktop - horizontal scroll on tablet, wrap on desktop */}
              <div className="relative hidden sm:block">
                <div className="flex gap-2 overflow-x-auto lg:flex-wrap pb-2 scrollbar-hide">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSearchQuery("");
                        setHasSearched(true);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 lg:shrink ${
                        selectedCategory === cat.id
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      {cat.label}
                      <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                        selectedCategory === cat.id 
                          ? 'bg-primary-foreground/20' 
                          : 'bg-foreground/10'
                      }`}>
                        {categoryCounts[cat.id] || 0}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Fade edge on tablet */}
                <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none lg:hidden" />
              </div>
            </div>
            
            {/* Vendor chips - Show when a specific category is selected */}
            {selectedCategory !== "all" && vendorsInCategory.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Vendors in {selectedCategoryData?.label}:</span>
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setHasSearched(false);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {vendorsInCategory.map(({ name, count }) => {
                    const isActive = searchQuery.toLowerCase() === name.toLowerCase();
                    return (
                      <button
                        key={name}
                        onClick={() => {
                          if (isActive) {
                            setSearchQuery("");
                            setHasSearched(false);
                          } else {
                            handleSearch(name);
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'bg-muted/50 hover:bg-muted border border-border hover:border-primary/30 text-foreground'
                        }`}
                      >
                        {name}
                        <span className={`${isActive ? 'opacity-75' : 'text-muted-foreground'}`}>({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Results count - Mobile optimized */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-4 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-foreground font-medium">
                {filteredData.length} reviews
              </span>
              {positiveCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                  <ThumbsUp className="h-3 w-3" />
                  {positiveCount} recommended
                </span>
              )}
              {lockedWarningCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-medium">
                  <Lock className="h-3 w-3" />
                  {lockedWarningCount} warnings
                  <span className="text-[10px] opacity-75">(Pro)</span>
                </span>
              )}
              {visibleWarningCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {visibleWarningCount} warnings
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Content Carousel */}
        <section className="py-8 sm:py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            {(() => {
              const FREE_ENTRIES = 3;
              
              // For non-Pro users: Show 1 warning first (if present) + 2 recommendations
              // This leverages loss aversion psychology while showing balanced value
              const recommendations = filteredData.filter(e => e.type !== "warning");
              const warnings = filteredData.filter(e => e.type === "warning");
              
              // SEARCH IS A PAID FEATURE: When a free user searches, show paywall instead of results
              const isSearchActive = searchQuery.trim().length > 0;
              const isSearchLocked = !accessLevel.unlimitedAccess && isSearchActive;
              
              let visibleEntries;
              if (accessLevel.unlimitedAccess) {
                visibleEntries = filteredData;
              } else if (isSearchLocked) {
                // Free users searching: show NO cards, just the paywall
                visibleEntries = [];
              } else {
                // Free users browsing (no search): show 3-card preview
                // Build visible entries: 1 warning first (if available), then recommendations
                const visibleList: VendorEntry[] = [];
                
                // Add first warning if present (leads with protective value)
                if (warnings.length > 0) {
                  visibleList.push(warnings[0]);
                }
                
                // Fill remaining slots with recommendations (up to 3 total)
                const recsNeeded = FREE_ENTRIES - visibleList.length;
                visibleList.push(...recommendations.slice(0, recsNeeded));
                
                // If still not at 3 (no recommendations), add more warnings
                if (visibleList.length < FREE_ENTRIES) {
                  const moreWarnings = warnings.slice(1, 1 + (FREE_ENTRIES - visibleList.length));
                  visibleList.push(...moreWarnings);
                }
                
                visibleEntries = visibleList;
              }
              
              const remainingCount = Math.max(0, filteredData.length - visibleEntries.length);
              
              // Combine visible entries with a "teaser" placeholder for non-Pro users
              const carouselItems = [...visibleEntries];
              const showTeaserCard = !accessLevel.unlimitedAccess && remainingCount > 0 && !isSearchLocked;
              
              return (
                <>
                  {/* Search Locked Paywall - Shows when free user searches */}
                  {isSearchLocked && filteredData.length > 0 && (
                    <div className="max-w-xl mx-auto">
                      <div className="relative overflow-hidden border-2 border-yellow-500/50 rounded-2xl p-8 sm:p-10 shadow-xl bg-gradient-to-br from-yellow-500/10 via-card to-orange-500/10">
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                        <div className="relative z-10 text-center">
                          <div className="p-4 rounded-full bg-yellow-500/20 mx-auto mb-4 w-fit">
                            <Lock className="h-8 w-8 text-yellow-600" />
                          </div>
                          <h3 className="text-2xl font-black text-foreground mb-2">
                            {filteredData.length} reviews found for "{searchQuery}"
                          </h3>
                          <div className="flex items-center justify-center gap-4 text-sm mb-4">
                            {positiveCount > 0 && (
                              <span className="flex items-center gap-1.5 text-green-600">
                                <ThumbsUp className="h-4 w-4" />
                                {positiveCount} recommended
                              </span>
                            )}
                            {lockedWarningCount > 0 && (
                              <span className="flex items-center gap-1.5 text-orange-600">
                                <AlertTriangle className="h-4 w-4" />
                                {lockedWarningCount} warnings
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                            Search results are a Pro feature. Upgrade to unlock full access to all vendor reviews, warnings, and dealer insights.
                          </p>
                          <button 
                            onClick={() => {
                              if (isAuthenticated) {
                                setShowUpgradeModal(true);
                              } else {
                                // Scroll to tiers section with offset
                                const tiersSection = document.getElementById('tiers-section');
                                if (tiersSection) {
                                  const offset = 100;
                                  const elementPosition = tiersSection.getBoundingClientRect().top + window.pageYOffset;
                                  window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
                                }
                              }
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-secondary hover:bg-secondary/90 text-yellow-950 font-bold text-base shadow-lg hover:shadow-xl transition-all cursor-pointer"
                          >
                            <Crown className="h-5 w-5" />
                            <span>{isAuthenticated ? 'Upgrade to Pro' : 'Join Pro to Unlock'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Carousel - Only show when not search-locked */}
                  {!isSearchLocked && carouselItems.length > 0 && (
                    <VendorCarousel
                      entries={carouselItems}
                      accessLevel={accessLevel}
                      userTier={userTier}
                      isAuthenticated={isAuthenticated}
                      cardRefs={cardRefs}
                      trackShare={trackShare}
                      setSelectedCardForShare={setSelectedCardForShare}
                      showTeaserCard={showTeaserCard}
                      remainingCount={remainingCount}
                      setShowUpgradeModal={setShowUpgradeModal}
                    />
                  )}
                  
                  {/* Upgrade prompts below carousel */}
                  {!accessLevel.unlimitedAccess && !isAuthenticated && (
                    <div id="tiers-section" className="mt-8">
                      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-primary/5 via-yellow-500/10 to-primary/5 border-2 border-border">
                        <div className="text-center mb-6">
                          <h3 className="text-xl sm:text-2xl font-black text-foreground mb-2">
                            Vendor intel is a Pro feature
                          </h3>
                          <p className="text-muted-foreground">
                            Join CDG Circles — the dealer peer network — to unlock full vendor reviews from real dealers
                          </p>
                        </div>
                        
                        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto items-stretch">
                          {/* Community Tier */}
                          <div className="p-5 rounded-xl bg-card border border-border flex flex-col">
                            <div className="flex items-center gap-2 mb-3 pt-3">
                              <User className="h-5 w-5 text-muted-foreground" />
                              <span className="font-bold text-foreground">Community</span>
                              <span className="ml-auto text-sm font-bold text-muted-foreground">$1/mo</span>
                            </div>
                            <ul className="space-y-2 text-sm text-muted-foreground mb-4 flex-1">
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                                <span><strong className="text-foreground">3 vendor reviews</strong> preview</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                                <span>General dealer chats</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                                <span>Weekly community summary</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                <span className="text-muted-foreground/70">Warnings locked</span>
                              </li>
                            </ul>
                            <Button 
                              variant="outline" 
                              className="w-full mt-auto"
                              asChild
                            >
                              <a href="https://buy.stripe.com/5kQaEXeXU4qm2dKbyU3oA0i" target="_blank" rel="noopener noreferrer" data-rewardful>
                                Join for $1
                              </a>
                            </Button>
                          </div>
                          
                          {/* Pro Tier */}
                          <div className="p-5 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/50 relative flex flex-col">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-yellow-500 text-yellow-950 text-xs font-bold">
                              FULL ACCESS
                            </div>
                            <div className="flex items-center gap-2 mb-3 pt-3">
                              <Crown className="h-5 w-5 text-yellow-600" />
                              <span className="font-bold text-foreground">Pro</span>
                              <span className="ml-auto text-sm font-bold text-yellow-600">
                                $99/mo
                              </span>
                            </div>
                            
                            <ul className="space-y-2 text-sm text-muted-foreground mb-4 flex-1">
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                                <span><strong className="text-foreground">{vendorDataSource.length}+ vendor reviews</strong></span>
                              </li>
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                                <span>{totalWarningCount}+ warnings & red flags</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                                <span>Private vendor discussions</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                                <span>Monthly roundtables + more</span>
                              </li>
                            </ul>
                            
                            <Button 
                              variant="yellow" 
                              className="w-full font-bold mt-auto"
                              asChild
                            >
                              <a 
                                href="https://buy.stripe.com/fZu28raHEe0W6u07iE3oA0h" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                data-rewardful
                              >
                                <Crown className="h-4 w-4 mr-2" />
                                Join Pro
                              </a>
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-center text-xs text-muted-foreground mt-4">
                          Billed quarterly. Cancel anytime. 1,000+ dealers already inside.
                        </p>
                        <p className="text-center text-xs text-muted-foreground mt-2">
                          <Link 
                            to="/auth?redirect=/vendors"
                            className="underline hover:text-foreground transition-colors"
                          >
                            Already a Pro member? Log in to unlock all reviews
                          </Link>
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {!accessLevel.unlimitedAccess && isAuthenticated && (
                    <div className="mt-8">
                      <div className="p-8 rounded-2xl bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10 border-2 border-yellow-500/30">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-yellow-500/20">
                              <Crown className="h-8 w-8 text-yellow-600" />
                            </div>
                            <div>
                              <h3 className="text-xl font-black text-foreground mb-1">
                                Upgrade to See All Vendor Reviews
                              </h3>
                              <p className="text-muted-foreground">
                                Unlock all {vendorDataSource.length} reviews including {totalWarningCount} warnings.
                              </p>
                            </div>
                          </div>
                          <Button 
                            variant="yellow" 
                            size="lg"
                            className="font-bold whitespace-nowrap px-8"
                            onClick={() => setShowUpgradeModal(true)}
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            Upgrade to Pro
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            
            {filteredData.length === 0 && (
              <div className="text-center py-16">
                <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-foreground mb-2">No results found</h3>
                <p className="text-muted-foreground">Try adjusting your search or category filter</p>
              </div>
            )}
          </div>
        </section>

        {/* Quote Card Modal */}
        {selectedCardForShare && (
          <QuoteCardModal
            isOpen={!!selectedCardForShare}
            onClose={() => setSelectedCardForShare(null)}
            quote={selectedCardForShare.quote}
            title={selectedCardForShare.title}
            type={selectedCardForShare.type}
          />
        )}

        {/* Upgrade Modal */}
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          targetTier="pro"
        />

        {/* Bottom CTA */}
        {!accessLevel.unlimitedAccess && !isLoading && (
          <section className="py-12 bg-muted/50 border-t border-border">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl mx-auto text-center">
                <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-4">
                  {isAuthenticated ? 'Upgrade to Pro for Full Vendor Access' : 'Vendor Intel is a Pro Feature'}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {isAuthenticated 
                    ? `Upgrade to Pro to unlock all ${vendorDataSource.length} vendor reviews including ${totalWarningCount} warnings.`
                    : `Join Circles Pro to access all ${vendorDataSource.length} vendor reviews, ${totalWarningCount} warnings, and curated dealer chat groups.`}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {isAuthenticated ? (
                    <Button 
                      variant="yellow" 
                      size="lg"
                      className="font-bold px-8"
                      onClick={() => setShowUpgradeModal(true)}
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Pro — $99/mo
                    </Button>
                  ) : (
                    <Button 
                      variant="yellow" 
                      size="lg"
                      className="font-bold px-8"
                      asChild
                    >
                      <a 
                        href="https://buy.stripe.com/fZu28raHEe0W6u07iE3oA0h"
                        target="_blank" 
                        rel="noopener noreferrer"
                        data-rewardful
                      >
                        <Crown className="h-4 w-4 mr-2" />
                        Join Pro — $99/mo
                      </a>
                    </Button>
                  )}
                  {!isAuthenticated && (
                    <Button 
                      variant="outline" 
                      size="lg"
                      onClick={() => window.open('https://cdgcircles.com/#pricing', '_blank')}
                    >
                      View all plans
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Billed quarterly ($297). Cancel anytime.
                </p>
              </div>
            </div>
          </section>
        )}
        
        {/* Footer */}
        <footer className="py-8 border-t border-border">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-6">
              <Link to="/" className="flex items-center gap-2">
                <img src={cdgCirclesLogo} alt="CDG Circles" className="h-6 opacity-70" />
              </Link>
              
              {/* Disclaimer */}
              <div className="max-w-2xl text-center">
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  <span className="font-medium">Disclaimer:</span> CDG Circles does not endorse, recommend, or guarantee any vendor listed here. 
                  All reviews and opinions are community-generated by Circles members and reflect their individual experiences. 
                  Always conduct your own due diligence before making vendor decisions.
                </p>
              </div>
              
              <div className="flex items-center gap-6">
                <a 
                  href="https://cardealershipguy.com/terms" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms
                </a>
                <a 
                  href="https://cardealershipguy.com/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy
                </a>
                <p className="text-sm text-muted-foreground">
                  © {new Date().getFullYear()} Car Dealership Guy
                </p>
              </div>
            </div>
          </div>
        </footer>

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-110"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </div>
    </>
  );
};

export default WinsWarnings;