# Public landing page redesign

## Scope and composition

Implements the approved Sindh reference on `/`, using the existing Next.js application, Geist, shared button styles, and installed Lucide icons. The homepage has transparent desktop navigation, accessible native mobile disclosure navigation, the exact three-line headline and description, red emergency CTA, anchor navigation, four feature highlights, a visible prototype notice, and concise workflow/community/about sections.

The map outline, locator dot and connecting line are already part of the supplied hero; no duplicate geography was drawn. The supplied illustration depicts an adult being assisted, while the reference screenshot depicts a child. The approved local illustration is preserved. Decorative Sindhi text is omitted because no verified wording was provided or found in the repository. A confirmed translation can be added later with an appropriate script-supporting font.

The emergency CTA navigates to the existing `/sos` placeholder and never claims a report has been sent. Volunteer-assisted reporting is explicitly described as planned; offline synchronization is unavailable. Hero artwork is identified as illustrative, not evidence of a real rescue. The homepage makes no operational rescue, government affiliation, deployment-statistic, or partnership claims.

## Assets

| Asset | Dimensions | Bytes | Usage |
| --- | --- | --- | --- |
| `frontend/public/images/hero-background.png` | 1672 x 941 | 2,113,438 | Supplied original, retained unchanged |
| `frontend/public/images/hero-background.webp` | 1672 x 941 | 190,374 | Optimized derivative used by the hero |
| `frontend/public/images/ResQLink Shield Brand Logo.png` | 2172 x 724 | 609,433 | Supplied transparent logo, retained unchanged |

The WebP derivative is approximately 91% smaller, generated with the existing Sharp dependency at quality 88. No image was generated or replaced. Next Image serves responsive sizes, preloads the decorative hero, and reserves intrinsic logo proportions. The logo uses its existing light wordmark without recoloring or cropping.

## Implementation and changed files

- `frontend/src/app/page.tsx`: homepage composition and absolute SEO title/description.
- `frontend/src/components/landing/LandingNavbar.tsx`: supplied logo, desktop links and native mobile menu with Escape support.
- `frontend/src/components/landing/LandingHero.tsx`: supplied hero art, exact copy, real CTA links, four highlights and a focusable skip-link target.
- `frontend/src/components/landing/LandingSections.tsx`: safety notice, three-step explanation, community/about sections and footer.
- `frontend/src/components/landing/landing.css`: responsive, reduced-motion-aware landing styles and semantic local color tokens.
- `frontend/src/components/landing/landing-styles.ts`: unique `rqLanding*` class names shared by the landing components.
- The three assets listed above.
- `frontend/tests/landing.spec.ts`: homepage interaction, responsive, image and accessibility checks.
- `docs/landing-page-redesign.md`: this handoff and verification record.

The repository's existing Turbopack Tailwind loader emits ordinary CSS for `.module.css`, so this page uses explicitly prefixed class names instead. No shared tokens, global stylesheet, Next configuration, dependency manifests, backend, authentication, dashboard, incident components, or SOS implementation were changed. Smooth scrolling is applied only while `html:has(.rqLandingPage)` matches and is disabled for reduced motion. The existing shared skip link targets the hero copy after navigation.

The emergency button uses a slightly darker red than the headline to preserve white-label contrast. Desktop uses the supplied illustration with a restrained navy overlay; tablet uses a two-column highlight grid and mobile uses a single column, stacked CTAs, readable type, and a stronger image overlay. No animation delays content or requires an animation library.

## Verification

The development server was checked at `http://localhost:3000`. Production was built with the example local API addresses and served separately at port 3100, allowing the standard Playwright configuration to reuse that server without a second development lock.

```powershell
cd frontend
npm run lint
npx tsc --noEmit
npm run build
# In another terminal, when testing the production build:
npm run start -- --port 3100
# Then:
npm test
```

A production build requires the public API URLs from `.env.example` to be set before building for authentication regression tests. Browser authentication/API responses were mocked; no credentials or database secrets were read or changed.

The new landing suite checks widths 375, 430, 768, 1024, 1280, 1440 and 1600px; one H1; exact headline/metadata; loaded local assets; no horizontal overflow; working emergency/login links; all section anchors; mobile keyboard open/Escape/close behavior; skip-link focus; reduced motion; and decorative image semantics. Screenshots are generated under ignored `frontend/test-results/`.

Screenshot paths after the landing suite:

- Desktop hero: `frontend/test-results/landing-approved-homepage-composition-at-1600px/hero-desktop-1600.png`.
- Desktop full page: `frontend/test-results/landing-approved-homepage-composition-at-1600px/homepage-1600.png`.
- Mobile full page: `frontend/test-results/landing-approved-homepage-composition-at-375px/homepage-375.png`.
- Other widths use the same naming pattern.

Initial CSS-module and image-test typing issues were fixed during verification. All 11 homepage tests passed in the first full regression run. That complete run had 34 passing and four failing tests. All four failures were dashboard overflow assertions: the standalone 375px dashboard check and the foundation suite's dashboard checks at 375, 768 and 1280px. Authentication, logout, admin rejection, dashboard search, incident modal and 1440px dashboard layout passed. The dashboard heading/controls are the observed overflow source; those implementation files are outside this task's scope.

Final focused verification:

- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed for the final source.
- `npx playwright test tests/landing.spec.ts`: all 11 passed against that final production build, including the activated skip link.
- Screenshots reviewed at every requested width, with the desktop hero compared to the approved reference.
- An additional Chrome production check observed initial layout shift of 0, one hero-image resource download, no horizontal overflow, and no unexpected browser console or JavaScript errors. Expected anonymous session HTTP 401 responses were mocked.

The attempted isolated runtime baseline comparison did not complete: its development compilation timed out. Source comparison against `origin/dev` confirmed no changes to dashboard, login, authentication, or shared global styles, but a completed runtime baseline comparison is not claimed. The four dashboard overflow failures remain unresolved and the full suite is not fully passing. The homepage's dedicated checks all pass. No unrelated dashboard repair was made in this branch.
