# Design Document: Sales Targets Page Redesign ("Command Center")

**Date**: 2026-03-26
**Status**: Validated
**Topic**: Sales Targets Page Redesign for scannability and high-impact sales workflows.

## 1. Overview
The Sales Targets page is an internal tool for the CDG Pulse sales team to prioritize vendor prospects. The current implementation is data-heavy (14 columns), leading to visual fatigue and slower decision-making. This redesign adopts a "Command Center" aesthetic with progressive disclosure to prioritize high-signal data.

## 2. Design Goals
- **Scannability**: Identify "hot" targets (high Pain/Buzz/Gap) in under 5 seconds.
- **Differentiated Aesthetic**: Move away from generic dashboards toward an "Intelligence Agency" field report vibe.
- **Workflow Efficiency**: Provide the "why" (scores/trends) before the "who" (dealer details).

## 3. Architecture & Components

### A. Main Table ("The Command Center")
- **Typography**: 
  - Monospace font for data points (scores, counts) to emphasize precision.
  - Geometric sans-serif for Vendor names.
- **Column Consolidation (Progressive Disclosure)**:
  - **Vendor & Category**: Single column. Vendor name (large, white), Category (small, muted zinc-500) underneath.
  - **The Trinity (Opportunity Scores)**: Pain, Buzz, and Gap grouped. Represented by 5-segment level indicators (e.g., `[■■■□□]`).
    - *High Pain (70+)*: subtle amber/red glow.
  - **The Pulse (Trend)**: 3-segment visual bar (Green/Yellow/Red blocks) showing sentiment direction.
  - **Volume**: "30d Mentions" as the primary volume metric.
- **Interactions**: 
  - Hover: Sharp `1px` white border ("crosshair") around the row.
  - Click: Expands into the Dossier.

### B. Expanded Row ("The Intelligence Dossier")
- **Layout**: 2-column top section + full-width bottom section.
- **Strategic Briefing (Left 40%)**: 
  - AI Synopsis styled as a field report.
  - Large "PITCH ANGLE" header.
  - "Lead with:" sentence emphasized.
- **Vital Signs (Right 60%)**: 
  - 2x4 grid of metric cards for data hidden from the main table (NPS, Health, Feature Gaps, Has Profile, etc.).
- **Dealer Proof (Bottom 100%)**: 
  - Dealer sub-table with "Verified" badges for confirmed users.
  - Direct links to source mentions (if available).

### C. Visual Polish
- **Color Palette**: Deep zincs (`zinc-900`, `zinc-950`), high-contrast white text for primary data, muted `zinc-500` for secondary labels.
- **Animations**: Sharp, fast staggered entrance (100ms offset) for dossier sections.

## 4. Implementation Strategy
- **Phase 1**: Update `SalesTargetsTable` and `SalesTargetsRow` to implement the new "Command Center" column layout.
- **Phase 2**: Refactor `SalesTargetsRow` expansion logic to use the "Dossier" layout.
- **Phase 3**: Apply typography and visual polish (monospace fonts, level indicators, hover effects).
- **Phase 4**: Enhance `DealerSubTable` and `AISynopsis` with the "Verified" and "Field Report" styling.

## 5. Testing & Validation
- Verify sorting still works correctly on the consolidated/hidden columns.
- Ensure the staggered animation doesn't cause layout shift or performance issues with large datasets.
- Check mobile/tablet responsiveness (though primary use is desktop).
