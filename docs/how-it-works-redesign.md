# How It Works product showcase

## Scope

This feature starts from integrated `dev` at `d46de0f`, after homepage PR #7 was merged. It replaces only the old How ResQLink Works section with `HowItWorks`, preserving `id="how-it-works"`, the existing headline, and the rest of the homepage.

Desktop uses an approximately 44/56 split: text and a numbered vertical timeline on the left, the approved laptop/mobile illustration on the right. Steps use the requested red, blue and green accents. Static dotted connection lines and masked radial lighting sit behind the image. Below 1100px, the layout stacks in the requested order: introduction, steps, CTA, full mockup, prototype note. The vertical process follows the written brief; the reference screenshot uses a horizontal step arrangement and an angled laptop, while this supplied asset is front-facing. No perspective transformation or cropping was applied.

The new CTA, ?See ResQLink in Action,? opens the existing `/sos` route. That page currently contains its honest coming-soon placeholder; the CTA does not submit a report or bypass coordinator authentication. The product mockup and its embedded numbers are explicitly illustrative, not a live incident feed. Prototype/no-dispatch messaging remains present, including the existing notice above the section.

## Exact supplied asset

- Source: `frontend/public/images/ResQLink Emergency Response Dashboard Mockup.png`.
- Public source URL: `/images/ResQLink%20Emergency%20Response%20Dashboard%20Mockup.png` (Next Image accepts the equivalent path with spaces).
- Dimensions: 1448 x 1086; aspect ratio 4:3.
- Original size: 1,546,370 bytes.
- Transparency: PNG alpha channel confirmed, with values from 0 to 255; the image is not opaque.

The original PNG is used unchanged. Next Image supplies responsive image optimization, lazy loading, intrinsic dimensions, descriptive alt text, `height: auto`, and `object-fit: contain`. Both devices remain fully visible. No extra phone, device frame, white card, replacement image, or altered screen content was added. A production-browser check observed one optimized WebP response of 69,524 bytes at 828 x 621, retaining alpha transparency. No separate derivative asset is committed.

## Files changed

- `frontend/src/components/landing/HowItWorks.tsx`: new static server-rendered section.
- `frontend/src/components/landing/how-it-works.css`: section-only `rqHow*` styles and local tokens.
- `frontend/src/components/landing/LandingSections.tsx`: replaces the old section markup with `<HowItWorks />`.
- `frontend/src/components/landing/landing.css`: removes only styles used exclusively by the retired section; other selectors keep their previous declarations.
- `frontend/src/components/landing/landing-styles.ts`: removes only the old section's unused class-name keys.
- `frontend/public/images/ResQLink Emergency Response Dashboard Mockup.png`: supplied asset.
- `frontend/tests/how-it-works.spec.ts`: focused responsive/image/anchor/CTA/reduced-motion checks.
- `docs/how-it-works-redesign.md`: this handoff.

No dependencies or global styles were added. Hero, navbar, logo, other homepage content, routes, dashboard, authentication, backend, API client, priority engine, and SOS logic were not changed. The saved 1600px hero screenshot compared pixel-identically before and after this feature.

## Verification

Required checks passed: `npm run lint`, `npx tsc --noEmit`, and `npm run build`. The existing development preview was inspected on port 3000; a production build on port 3100 was used for tests without interrupting that preview.

```powershell
cd frontend
npx playwright test tests/landing.spec.ts tests/how-it-works.spec.ts
npx playwright test tests/foundation.spec.ts tests/dashboard.spec.ts --grep 'validates fields|mocked cookie session|rejects ordinary|handles expiry|loading keeps|does not report success|search input|clicking an incident'
```

- Homepage and showcase: 20 passed (11 existing homepage checks plus nine new section checks).
- Selected authentication/dashboard regressions: eight passed, covering invalid login, cookie/session flow, logout, role rejection, connection recovery, expiry, loading, rejected cookies, dashboard search and incident modal.
- Responsive checks cover 375, 430, 768, 1024, 1280, 1440 and 1600px, including full image bounds/aspect ratio, desktop two-line heading, no image/text overlap, mobile ordering and no horizontal overflow.
- Existing anchors and the public CTA reach real routes/content. Keyboard navigation and reduced motion remain functional.
- Production observation: initial layout shift 0 and no unexpected browser console/JavaScript errors. Expected anonymous HTTP 401 session responses were mocked.
- Screenshots visually reviewed at all five specifically requested widths (375, 430, 768, 1024, 1440), with the desktop composition compared to the supplied reference.

Screenshots are copied to ignored `frontend/playwright-report/how-it-works/how-it-works-<width>.png` so subsequent test runs do not erase the handoff captures. The unchanged hero comparison is `frontend/playwright-report/how-it-works/hero-unchanged-1600.png`. The test's screenshot-only style excludes an offscreen fixed skip link that Chromium can incorrectly include in tall element captures; the actual link and its keyboard behavior are unchanged.

The complete regression suite was not rerun. Four dashboard overflow failures from the previous homepage verification remain documented in `docs/landing-page-redesign.md`; this feature does not claim those are resolved. No live coordinator credentials or production emergency services were used. The existing user-owned untracked brain pack is excluded from the commit.
