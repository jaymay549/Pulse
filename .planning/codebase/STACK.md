# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**
- TypeScript 5.8.3 - Frontend application and Edge Functions
- JavaScript (modern ES modules) - Configuration files and runtime

**Secondary:**
- SQL - Database queries and migrations (Supabase PostgreSQL)
- Bash/Shell - Build and deployment scripts

## Runtime

**Environment:**
- Node.js (JavaScript ES modules) - Development and build environment
- Deno - Supabase Edge Functions runtime (based on Deno standard library)
- Web browsers - Client-side React application

**Package Manager:**
- npm 10+ (inferred from `"type": "module"` in package.json)
- Lockfile: Present (`package-lock.json`)

## Frameworks

**Core:**
- React 18.3.1 - UI framework
- React Router DOM 6.30.1 - Client-side routing
- TypeScript - Type safety and development experience

**Build/Dev:**
- Vite 5.4.19 - Frontend build tool and dev server
- SWC (via `@vitejs/plugin-react-swc` 3.11.0) - Fast JavaScript transpiler
- PostCSS 8.5.6 - CSS processing
- Tailwind CSS 3.4.17 - Utility-first CSS framework

**UI Component Libraries:**
- shadcn/ui - Headless component library
- Radix UI 1.x - Accessible primitive components
  - `@radix-ui/react-accordion` 1.2.11
  - `@radix-ui/react-avatar` 1.1.10
  - `@radix-ui/react-checkbox` 1.3.3
  - `@radix-ui/react-dialog` 1.1.14
  - `@radix-ui/react-dropdown-menu` 2.1.16
  - `@radix-ui/react-hover-card` 1.1.15
  - `@radix-ui/react-label` 2.1.7
  - `@radix-ui/react-popover` 1.1.14
  - `@radix-ui/react-scroll-area` 1.2.10
  - `@radix-ui/react-select` 2.2.6
  - `@radix-ui/react-separator` 1.1.8
  - `@radix-ui/react-slot` 1.2.3
  - `@radix-ui/react-switch` 1.2.6
  - `@radix-ui/react-tabs` 1.1.13
  - `@radix-ui/react-toast` 1.2.14
  - `@radix-ui/react-tooltip` 1.2.7

**Testing:**
- Playwright 1.57.0 - E2E testing framework (via `@playwright/test`)
- No unit test framework configured

**Utilities:**
- Lucide React 0.462.0 - Icon library
- Framer Motion 12.26.1 - Animation library
- Tailwind Merge 2.6.0 - Merge Tailwind class utilities
- Tailwindcss Animate 1.0.7 - Animation utilities for Tailwind

**Charts & Data Visualization:**
- Recharts 3.7.0 - Composable charting library

**UI/UX Enhancements:**
- Embla Carousel 8.6.0 - Carousel component
- Sonner 1.7.4 - Toast notifications
- Vaul 0.9.9 - Drawer primitive
- React Helmet Async 2.0.5 - Head management for SEO
- React Markdown 10.1.0 - Markdown parsing and rendering
- Input OTP 1.4.2 - OTP input component

**Development Tools:**
- ESLint 9.32.0 - JavaScript linting
- `@eslint/js` 9.32.0 - ESLint recommended config
- `typescript-eslint` 8.38.0 - TypeScript ESLint support
- `eslint-plugin-react-hooks` 5.2.0 - React hooks linting
- `eslint-plugin-react-refresh` 0.4.20 - React Fast Refresh linting
- Autoprefixer 10.4.21 - CSS vendor prefix plugin
- Lovable Tagger 1.1.11 - Component tagging for development
- @types/node 22.16.5 - Node.js type definitions
- @types/react 18.3.23 - React type definitions
- @types/react-dom 18.3.7 - React DOM type definitions

**Data & State Management:**
- TanStack React Query 5.83.0 - Server state management
- Zod 3.25.76 - TypeScript-first schema validation

**Styling:**
- CSS variables (CSS custom properties) - Theme support with HSL colors
- Dark mode support via `next-themes` 0.3.0

**Other:**
- Class Variance Authority 0.7.1 - CSS-in-JS variant management
- CLSX 2.1.1 - Class name utility
- html2canvas 1.4.1 - HTML to canvas rendering

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.76.1 - Supabase PostgreSQL client with Row-Level Security (RLS)
- `@clerk/clerk-react` 5.60.0 - Authentication and session management with JWT tokens
- `@tanstack/react-query` 5.83.0 - Server state synchronization

**Infrastructure:**
- React 18.3.1 - Core framework
- Vite 5.4.19 - Build and dev infrastructure
- TypeScript 5.8.3 - Type safety

## Configuration

**Environment:**
- Configured via `.env` file (not committed to repository)
- Example configuration in `.env.example`:
  - `VITE_WAM_URL` - WAM backend API URL (defaults to Railway production)
  - `VITE_STRIPE_CHECKOUT_URL` - Stripe checkout link
- Additional variables loaded from environment at build time:
  - `VITE_SUPABASE_URL` - Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Supabase anon key
  - `VITE_CLERK_PUBLISHABLE_KEY` - Clerk authentication key (auto-switches between prod/preview by hostname)
  - `VITE_STRIPE_PORTAL_URL` - Stripe customer portal (optional)
  - `VITE_LOGO_DEV_TOKEN` - Development token for logo service (optional)

**Build Configuration:**
- `vite.config.ts` - Vite configuration with SWC plugin and path aliases
- `tsconfig.json` - TypeScript compilation settings
  - `noImplicitAny: false` - Implicit any allowed
  - `strictNullChecks: false` - Lenient null checks
  - `skipLibCheck: true` - Skip type checking of declaration files
  - Base URL: `.` with `@/*` alias pointing to `./src/*`
- `tailwind.config.ts` - Tailwind CSS customization with extended theme
- `postcss.config.js` - PostCSS configuration for Tailwind
- `eslint.config.js` - ESLint configuration with TypeScript and React hooks support
- `playwright.config.ts` - E2E test configuration using Lovable preset

## Platform Requirements

**Development:**
- Node.js (ES modules support required)
- npm or yarn package manager
- Vite dev server runs on `localhost:8080`
- TypeScript 5.8.3+

**Production:**
- Vercel (deployment platform)
- GitHub for version control
- Supabase PostgreSQL database
- Clerk authentication backend
- Railway (WAM backend)
- Google Gemini API (for Edge Functions)
- Stripe (billing integration)

## Scripts

```bash
npm run dev          # Start Vite dev server on localhost:8080
npm run build        # Production build (vite build)
npm run build:dev    # Development build with sourcemaps
npm run lint         # Run ESLint on all files
npm run preview      # Preview production build locally
```

---

*Stack analysis: 2026-04-13*
