import { test, expect } from "@playwright/test";

/**
 * CAR-19 — Competitor Leaderboard e2e tests.
 *
 * Status: scaffold. Most tests are skipped pending two pieces of infrastructure:
 *
 *   1. A vendor-auth helper. The app uses Supabase magic-link for vendor
 *      auth (separate from Clerk, per CLAUDE.md). Write a helper that either
 *      programmatically issues a Supabase session (bypassing the email step)
 *      or seeds a long-lived dev session into local storage. Until that
 *      exists, vendor-tier tests cannot run.
 *
 *   2. Seeded fixtures. Three test vendors are needed:
 *        - "Acme CRM Test" — vendor in a populated category (>= 5 qualifying
 *          competitors). Used by the happy-path test.
 *        - "Niche Test Vendor" — vendor whose specific segment yields fewer
 *          than 3 qualifying vendors, causing the leaderboard to widen to the
 *          broader category and render the WidenedNotice paragraph.
 *        - "Solo Test Vendor" — vendor truly alone in its segment (< 2
 *          qualifying vendors) so the EmptyState renders with heading
 *          "Not enough data yet to rank you against competitors."
 *      Seed these into supabase/seed.sql or a dedicated test database.
 *
 * Once both are in place, replace each `test.skip(...)` with `test(...)` and
 * remove the `loginAsVendor` placeholder.
 *
 * Selector rationale (verified against component source):
 *   - Leaderboard rows: <button aria-label="Rank 01, Acme CRM, Pulse score 62">
 *     — LeaderboardRow renders `aria-label={`Rank ${vendor.rank}, ${vendor.vendor_name}, Pulse score ${vendor.health_score ?? "not yet scored"}`}`
 *     — Rank is zero-padded with padStart(2, "0"), so patterns like /^Rank \d\d/ match.
 *   - Sort chips toolbar: <div role="toolbar" aria-label="Sort leaderboard">
 *     — Chips are <button aria-pressed={...}> inside the toolbar.
 *   - Median strip: <div role="separator" aria-label="Segment median: Pulse N">
 *     — MedianRow renders this with the health_score inline.
 *   - Your shape card: the kicker label reads "Your shape" (verbatim, with
 *     leading space if trimmed).
 *   - Tier 2 capability card kicker: "◆ Available in Tier 2"
 *   - Empty state heading: "Not enough data yet to rank you against competitors."
 *   - Broader-category notice: rendered by WidenedNotice whose text contains
 *     "broader" and the widenedTo category name.
 *   - Section heading: "Where you rank, across every metric." (rendered by
 *     LeaderboardHeader as an <h2>).
 */

test.describe("CompetitorLeaderboard — happy path", () => {
  test.skip(
    "renders header, sort chips, ranked rows, median strip, your shape card",
    async ({ page }) => {
      // TODO(car-19-tests): wire vendor-auth helper + Acme CRM Test fixture.
      await loginAsVendor(page, { tier: "tier_1", vendorName: "Acme CRM Test" });

      await page.goto("/vendor-dashboard");
      // Navigate to the Market Intel tab within the vendor dashboard.
      await page.getByRole("button", { name: /market intel/i }).click();

      // Header h2 rendered by LeaderboardHeader.
      await expect(
        page.getByRole("heading", { name: /where you rank, across every metric/i }),
      ).toBeVisible();

      // Sort chips toolbar — role="toolbar" aria-label="Sort leaderboard".
      const toolbar = page.getByRole("toolbar", { name: /sort leaderboard/i });
      await expect(toolbar).toBeVisible();
      // Default sort chip is "Pulse Score" with aria-pressed="true".
      await expect(
        toolbar.getByRole("button", { name: "Pulse Score" }),
      ).toHaveAttribute("aria-pressed", "true");

      // Leaderboard rows — buttons whose aria-label begins "Rank NN".
      const rows = page.getByRole("button", { name: /^Rank \d\d/ });
      await expect(rows.first()).toBeVisible();
      expect(await rows.count()).toBeGreaterThanOrEqual(5);

      // Median separator — role="separator" aria-label="Segment median: Pulse N".
      await expect(
        page.getByRole("separator", { name: /segment median: pulse/i }),
      ).toBeVisible();

      // YourShapeCard kicker text (exact rendering: "Your shape" in a <div>).
      await expect(page.getByText("Your shape")).toBeVisible();
    },
  );
});

test.describe("CompetitorLeaderboard — tier behavior", () => {
  test.skip(
    "Tier 1 vendor sees the Tier 2 capability card",
    async ({ page }) => {
      // TODO(car-19-tests): wire vendor-auth helper + Tier-1 fixture.
      await loginAsVendor(page, { tier: "tier_1", vendorName: "Acme CRM Test" });
      await page.goto("/vendor-dashboard");
      await page.getByRole("button", { name: /market intel/i }).click();
      // Tier2CapabilityCard kicker reads "◆ Available in Tier 2".
      await expect(page.getByText(/available in tier 2/i)).toBeVisible();
    },
  );

  test.skip(
    "Tier 2 vendor does not see the Tier 2 capability card",
    async ({ page }) => {
      // TODO(car-19-tests): wire vendor-auth helper + Tier-2 fixture.
      // CompetitorLeaderboard only renders <Tier2CapabilityCard> when isT1 is
      // true (i.e. tier !== "tier_2"). A Tier 2 session should suppress it.
      await loginAsVendor(page, { tier: "tier_2", vendorName: "Acme CRM Test" });
      await page.goto("/vendor-dashboard");
      await page.getByRole("button", { name: /market intel/i }).click();
      await expect(page.getByText(/available in tier 2/i)).toHaveCount(0);
    },
  );
});

test.describe("CompetitorLeaderboard — edge cases", () => {
  test.skip(
    "thin segment renders the broader-category notice",
    async ({ page }) => {
      // TODO(car-19-tests): seed Niche Test Vendor (segment has < 3 qualifying
      // vendors so the leaderboard RPC returns widened_to !== null).
      // WidenedNotice renders: "Compared against the broader {widenedTo} category."
      await loginAsVendor(page, { tier: "tier_1", vendorName: "Niche Test Vendor" });
      await page.goto("/vendor-dashboard");
      await page.getByRole("button", { name: /market intel/i }).click();
      await expect(page.getByText(/compared against the broader/i)).toBeVisible();
    },
  );

  test.skip(
    "vendor alone in segment shows gathering empty state",
    async ({ page }) => {
      // TODO(car-19-tests): seed Solo Test Vendor (< 2 qualifying vendors so
      // data.vendors.length < 2 and the EmptyState branch renders).
      await loginAsVendor(page, { tier: "tier_1", vendorName: "Solo Test Vendor" });
      await page.goto("/vendor-dashboard");
      await page.getByRole("button", { name: /market intel/i }).click();
      await expect(
        page.getByRole("heading", {
          name: /not enough data yet to rank you against competitors/i,
        }),
      ).toBeVisible();
    },
  );
});

test.describe("CompetitorLeaderboard — accessibility and motion", () => {
  test.skip(
    "respects prefers-reduced-motion — row animation is suppressed",
    async ({ browser }) => {
      // TODO(car-19-tests): wire vendor-auth helper.
      // LeaderboardRow uses motion-safe:animate-[leaderboard-row-in_...] so
      // with reducedMotion: "reduce" the animation class should not fire.
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await loginAsVendor(page, { tier: "tier_1", vendorName: "Acme CRM Test" });
      await page.goto("/vendor-dashboard");
      await page.getByRole("button", { name: /market intel/i }).click();

      const firstRow = page.getByRole("button", { name: /^Rank \d\d/ }).first();
      await expect(firstRow).toBeVisible();
      const animations = await firstRow.evaluate(
        (el) => el.getAnimations().filter((a) => a.playState !== "idle").length,
      );
      expect(animations).toBe(0);
    },
  );

  test.skip(
    "keyboard tab order moves through sort chips then into rank rows",
    async ({ page }) => {
      // TODO(car-19-tests): wire vendor-auth helper.
      // SortChips renders buttons inside role=toolbar; LeaderboardRow renders
      // focus-visible styles, so focus should be reachable via Tab.
      await loginAsVendor(page, { tier: "tier_1", vendorName: "Acme CRM Test" });
      await page.goto("/vendor-dashboard");
      await page.getByRole("button", { name: /market intel/i }).click();

      // Focus the toolbar then Tab into the first chip.
      await page.getByRole("toolbar", { name: /sort leaderboard/i }).focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Pulse Score" }),
      ).toBeFocused();

      // Tab past the remaining 4 sort chips (Product Stability, Customer
      // Experience, Value Perception, Volume) — 4 more Tabs.
      for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");

      // One more Tab should reach the first leaderboard row (Rank 01).
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: /^Rank 01/ }),
      ).toBeFocused();
    },
  );
});

// ─── Placeholder auth helper ────────────────────────────────────────────────

/**
 * Placeholder vendor-auth helper. Throws deliberately — every test that calls
 * this is currently wrapped in `test.skip(...)`. Replace with the real helper
 * once vendor-auth bootstrap exists.
 *
 * Implementation notes for whoever picks this up:
 *   - Vendor auth is Supabase magic-link (NOT Clerk). See CLAUDE.md §Auth
 *     separation and §Vendor Tiering System.
 *   - The simplest approach is to call `supabase.auth.signInWithOtp()` with a
 *     seeded test email in a Supabase local dev environment, capture the token
 *     from the generated link, and call `supabase.auth.verifyOtp()` to
 *     exchange it for a session — all in a Node context before `page.goto()`.
 *   - Then seed the session into the page via `page.addInitScript()` /
 *     `page.evaluate()` before navigating.
 */
async function loginAsVendor(
  _page: import("@playwright/test").Page,
  _opts: { tier: "tier_1" | "tier_2"; vendorName: string },
): Promise<void> {
  throw new Error(
    "loginAsVendor placeholder — wire the real Supabase magic-link bypass before unskipping these tests.",
  );
}
