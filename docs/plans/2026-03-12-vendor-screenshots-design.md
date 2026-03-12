# Vendor Product Screenshots Design

**Date:** 2026-03-12
**Status:** Approved

## Overview

Vendors with admin-approved claimed profiles can upload up to 8 product screenshots. Screenshots appear as a horizontal scroll strip on the public vendor profile page (hidden if empty). Management lives in the vendor dashboard.

## Data Layer

### Table: `vendor_screenshots`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| vendor_name | text NOT NULL | loose FK to vendor_profiles.vendor_name |
| url | text NOT NULL | Supabase Storage public URL |
| sort_order | int NOT NULL DEFAULT 0 | 0–7 |
| created_at | timestamptz | DEFAULT now() |

### Storage: `vendor-screenshots` bucket (public)
- Path pattern: `{vendor_name}/{uuid}.{ext}`
- Accepted types: jpg, png, webp
- Max file size enforced client-side: 5MB

### RLS
- SELECT: public
- INSERT/UPDATE/DELETE: vendor_name must be in vendor_profiles WHERE clerk_user_id = auth.uid() AND is_approved = true
- Service role: full access

## Components

### `ProductScreenshots.tsx` (public profile)
- Fetches screenshots via React Query
- Returns null if screenshots.length === 0 (entire component hidden)
- Horizontal scroll strip: overflow-x-auto + scroll-snap-type x mandatory
- Each item: snap-start, w-[72vw] md:w-[420px], aspect-video, object-cover, rounded-xl
- Click → shadcn Dialog lightbox with prev/next arrows and counter
- Placed below vendor description in VendorProfile.tsx

### `DashboardScreenshots.tsx` (vendor dashboard)
- Shows current screenshots as a grid of thumbnails
- Upload dropzone (file input): jpg/png/webp, max 5MB, max 8 total
- Per-screenshot: up/down arrows to reorder (no dnd-kit needed), delete button
- Counter: "X / 8 screenshots"
- Uses authed supabase client for uploads/mutations

### `useVendorScreenshots.ts`
- fetch: public supabase client, ordered by sort_order ASC
- upload: authed client → storage upload → insert row
- delete: authed client → storage remove → delete row
- reorder: authed client → batch update sort_order

## Placement
- Public: `VendorProfile.tsx` below `<ExpandableDescription>` section
- Dashboard: new section in `VendorDashboardPage.tsx` sidebar nav + conditional render
