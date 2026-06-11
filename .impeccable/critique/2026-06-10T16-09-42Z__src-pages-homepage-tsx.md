---
target: src/pages/HomePage.tsx
total_score: 28
p0_count: 1
p1_count: 3
timestamp: 2026-06-10T16-09-42Z
slug: src-pages-homepage-tsx
---
# Critique Report: Baan 7 Homepage

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | Clicking "Join Now" renders a blank page due to a missing `/login` route. |
| 2 | Match System / Real World | 4/4 | Excellent use of campus terminology ("Vibe Check", "Baan") and student-friendly copy. |
| 3 | User Control and Freedom | 4/4 | Includes a functional "Rewind" swipe action; sticky navigation provides easy exits. |
| 4 | Consistency and Standards | 2.5/4 | Feature grid ignores intended column spans, creating a flat identical card structure; minor button radius mismatches. |
| 5 | Error Prevention | 3.5/4 | Very defensive fallback handling for unconfigured Immich URL, but missing route is not prevented. |
| 6 | Recognition Rather Than Recall | 4/4 | Highly visible navigation elements and explicit iconography labels. |
| 7 | Flexibility and Efficiency | 2/4 | No keyboard shortcut accelerators (e.g., arrow keys) for swiping on the Vibe Check page. |
| 8 | Aesthetic and Minimalist Design | 3/4 | The Warm Ivory and Chocolate Fondant palette feels cohesive, but relies on overused blur-blob background patterns. |
| 9 | Error Recovery | 1/4 | Missing route `/login` results in a blank view with no error fallback or custom 404 page. |
| 10 | Help and Documentation | 2/4 | Helpful descriptions, but no interactive guidance or tooltip definitions for custom portals. |
| **Total** | | **28/40** | **Good** (Solid foundation, but critical routing and layout bugs require attention) |

## Anti-Patterns Verdict

* **LLM Assessment:** The interface is visually stunning, featuring high-contrast serif headers and a sophisticated organic color palette that fits the campus community theme. However, it displays two prominent AI design tells: it uses blurry, floating background blobs (mesh gradients) as a decoration, and the feature grid has collapsed into four identical, repeating vertical cards due to missing span parameters.
* **Deterministic Scan:** The automated design scanner returned zero structural violations.
* **Visual Overlays:** Overlays were skipped as no live mutations were required for static analysis.

## Overall Impression

The Baan 7 portal is an exceptionally elegant site that represents the organic, warm creative direction perfectly. The canvas feels human and cozy. However, the site suffers from a few incomplete implementation details (a broken Unsplash image link in the gallery, a missing `/login` route that breaks the primary "Join Now" action, and a flat identical grid layout that undermines the asymmetry).

## What's Working

1. **Typographic Pairing:** The combination of *Playfair Display* for headers and *Plus Jakarta Sans* for body copy establishes clear contrast, elegance, and readability.
2. **Defensive Configurations:** The integration logic for the external Immich server is highly robust, intercepting clicks with a helpful toast when the server is unconfigured, preventing page crashes.

## Priority Issues

* **[P0] Missing /login Route & Empty Page View**
  * *Why it matters:* Clicking "Join Now" in the header or menu results in a completely blank view since the path `/login` is not registered in the router.
  * *Fix:* Create the login page component (`src/pages/LoginPage.tsx`), configure a lightweight user context, and register the route in `src/App.tsx`.
  * *Suggested command:* `$impeccable onboard src/pages/LoginPage.tsx`
* **[P1] Broken Image in Gallery Page**
  * *Why it matters:* The second image in the gallery uses an invalid Unsplash URL, rendering as a broken image icon and detracting from the premium aesthetic.
  * *Fix:* Replace the Unsplash ID in `src/pages/GalleryPage.tsx` with a verified working image ID.
  * *Suggested command:* `$impeccable polish src/pages/GalleryPage.tsx`
* **[P1] Purple Accent Violation on Vibe Check Page**
  * *Why it matters:* The "Boost" button uses a violet background and purple icon, violating the absolute Purple Ban designed to prevent AI-style color templates.
  * *Fix:* Recolor the button using a warm amber/gold palette (e.g. background `#fffbeb` and icon `#d97706`).
  * *Suggested command:* `$impeccable colorize src/pages/VibeCheckPage.tsx`
* **[P1] Feature Grid Layout Spans Missing**
  * *Why it matters:* The feature grid on the homepage renders as four identical columns, flattening the intended layout asymmetry (2x2 for Vibe Check, 2x1 for Hype Board).
  * *Fix:* Add grid-span parameters (`gridColumn={{ md: 'span 2' }}` and `gridRow={{ md: 'span 2' }}`) to the wrappers in `src/pages/HomePage.tsx`.
  * *Suggested command:* `$impeccable layout src/pages/HomePage.tsx`
* **[P2] Missing Swipe Keyboard Shortcuts**
  * *Why it matters:* Users on desktop must click tiny action buttons to navigate swipes, hurting power-user speed and accessibility.
  * *Fix:* Implement arrow key event listeners on the Vibe Check page to swipe left/right.
  * *Suggested command:* `$impeccable adapt src/pages/VibeCheckPage.tsx`
* **[P2] Cliché Aurora Background Blobs**
  * *Why it matters:* Floating blurred background circles feel like standard SaaS clichés rather than a custom-tailored layout.
  * *Fix:* Replace the CSS blur blobs with organic SVG line art or a clean noise canvas.
  * *Suggested command:* `$impeccable quieter src/pages/HomePage.tsx`

## Persona Red Flags

* **Jordan (Confused First-Timer):** Clicked the prominent "Join Now" call-to-action button to begin orientation, but was met with a blank page. Finding a broken image in the gallery further degraded trust.
* **Alex (Impatient Power User):** Visited the Vibe Check matching game on desktop and tried swiping using the arrow keys, but nothing happened, forcing repetitive click actions.
* **Pim (Freshman Student - Project Specific):** Navigating the site on mobile to check events before orientation. Encountered a broken sunset photo in the gallery and a blank screen when tapping "Join Now".

## Minor Observations

* The "Watch Intro" secondary button on the homepage links to a hash anchor `#features` but uses play icon typography, which might confuse users into expecting a video overlay.
* Button rounded borders have slight scale differences across card blocks (some are full pills, others are rounded-xl).

## Questions to Consider

* What if the "Watch Intro" action launched a smooth modal video player rather than jumping directly to the features grid?
* How can we extend the custom SVG scroll line to weave through the Vibe Check swipe card to guide the visual path?
