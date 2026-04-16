---
phase: quick
plan: 260416-o1s
subsystem: admin-sidebar
tags: [admin, sidebar, dnd-kit, localStorage, ux]
dependency_graph:
  requires: []
  provides: [admin-sidebar-sections, sidebar-persistence]
  affects: [src/components/admin/AdminSidebar.tsx]
tech_stack:
  added: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"]
  patterns: [sortable-dnd, localStorage-persistence, collapsible-section]
key_files:
  created:
    - src/hooks/useAdminSidebarConfig.ts
  modified:
    - src/components/admin/AdminSidebar.tsx
    - package.json
    - package-lock.json
decisions:
  - "DragOverlay used for drag preview so the original item fades in-place during drag"
  - "Unused section stays hidden (not rendered) when collapsed to avoid layout shift"
  - "overSection state tracks where drop will land, enabling cross-section moves"
metrics:
  duration: "~8min"
  completed: "2026-04-16"
  tasks: 2
  files: 4
---

# Quick Task 260416-o1s: CAR-29 Admin Sidebar Active/Unused Sections with DnD

**One-liner:** AdminSidebar reorganized into Active/Unused collapsible sections using dnd-kit with localStorage persistence keyed by Clerk userId.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install dnd-kit and create useAdminSidebarConfig hook | 492c1ee | package.json, package-lock.json, src/hooks/useAdminSidebarConfig.ts |
| 2 | Refactor AdminSidebar with Active/Unused sections and DnD | 955cfb7 | src/components/admin/AdminSidebar.tsx |

## What Was Built

### useAdminSidebarConfig hook (`src/hooks/useAdminSidebarConfig.ts`)
- Exports `NAV_ITEMS` array with all 17 admin nav items (each with `id`, `to`, `icon`, `label`, `end?`)
- `DEFAULT_UNUSED_IDS`: `["send", "prompts", "trends", "debug"]`
- Reads/writes `admin-sidebar-config-${userId}` from localStorage on mount and on userId change
- Forward-compatible: new items not in stored config are appended to `activeIds`
- Exposes `activeItems`, `unusedItems`, `moveItem(id, section, index?)`, `reorderSection(section, orderedIds[])`

### AdminSidebar component (`src/components/admin/AdminSidebar.tsx`)
- `SortableNavItem` uses `useSortable` from dnd-kit with CSS transform/transition
- `DndContext` with `closestCenter` wraps the nav area
- Active section: 13 items by default (all except send/prompts/trends/debug)
- Unused section: separated by border-t, collapsed by default with ChevronDown toggle (rotates 180deg when expanded)
- Unused items render with `text-zinc-500` (dimmer) vs `text-zinc-400` for active items
- `DragOverlay` shows a styled floating preview while dragging
- Cross-section moves call `moveItem()`, within-section reorders call `reorderSection()` via `arrayMove`
- "Back to Pulse" link is outside the DnD context (not draggable)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None - no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] `src/hooks/useAdminSidebarConfig.ts` exists
- [x] `src/components/admin/AdminSidebar.tsx` updated
- [x] Commit 492c1ee exists
- [x] Commit 955cfb7 exists
- [x] `npm run build` succeeds with no errors
