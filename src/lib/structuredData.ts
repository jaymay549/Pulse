export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "CDG Circles",
  "url": "https://cdgcircles.com",
  "logo": "https://cdgcircles.com/assets/cdg-circles-logo-black.png",
  "description": "Modern peer network for auto dealers. Join 500+ verified dealers in structured peer collaboration. Private dealer chats. Curated intelligence. Real insights.",
  "email": "circles@cardealershipguy.com",
  "foundingDate": "2025",
  "sameAs": [
    "https://twitter.com/lovable_dev"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "email": "circles@cardealershipguy.com",
    "contactType": "Customer Service"
  }
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "CDG Circles",
  "url": "https://cdgcircles.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://cdgcircles.com/?s={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

export const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "CDG Circles Pro Membership",
  "description": "Elite peer network for auto dealers with curated groups, monthly peer sessions, and structured collaboration.",
  "image": "https://cdgcircles.com/assets/cdg-logo.png",
  "brand": {
    "@type": "Brand",
    "name": "CDG Circles"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://cdgcircles.com/#pricing",
    "priceCurrency": "USD",
    "price": "99",
    "priceValidUntil": "2026-12-31",
    "availability": "https://schema.org/InStock"
  }
};

export const faqSchema = (faqs: Array<{ question: string; answer: string }>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(faq => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer
    }
  }))
});