import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
  structuredData?: object;
  googleVerification?: string;
}

const SEO = ({ 
  title, 
  description, 
  canonical, 
  ogImage = "https://storage.googleapis.com/gpt-engineer-file-uploads/WhlLnfJIwKVlSimlwybjpza10o72/social-images/social-1761176090866-Screenshot 2025-10-22 at 7.33.38 PM.png",
  noindex = false,
  structuredData,
  googleVerification
}: SEOProps) => {
  const siteUrl = "https://cdgcircles.com";
  const fullCanonical = canonical ? `${siteUrl}${canonical}` : siteUrl;
  
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullCanonical} />
      
      {/* Robots */}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Google Search Console Verification */}
      {googleVerification && <meta name="google-site-verification" content={googleVerification} />}
      
      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="CDG Circles" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:site" content="@DGsocialmedia" />
      
      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;