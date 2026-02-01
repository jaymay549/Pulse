import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";

// Use dev key for preview domains, live key for production
const getClerkPublishableKey = (): string => {
  const hostname = window.location.hostname;
  
  // Production domains
  const isProduction = 
    hostname === "cdgpulsecom.lovable.app" || 
    hostname === "cdgpulse.com" ||
    hostname === "www.cdgpulse.com";
  
  if (isProduction) {
    return import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
  }
  
  // Development/preview - use test key
  return "pk_test_ZXZvbHZlZC1waWdlb24tMjguY2xlcmsuYWNjb3VudHMuZGV2JA";
};

const CLERK_PUBLISHABLE_KEY = getClerkPublishableKey();

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk publishable key");
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
    <App />
  </ClerkProvider>,
);
