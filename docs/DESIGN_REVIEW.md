# Portal design review - 28 October 2026

## Scope and visual authority

Reviewed the Student, Trainer and Admin interface against DESIGN_SYSTEM.md and the supplied Stitch screenshots, with original ZIP archives preserved. This is a correction pass over the existing visual language: the blue Student/Trainer shell, navy Admin shell, typography families, cards and assessment preferences remain the visual baseline. No real credentials, student records or hosted assessment content are used for the audit.

The route inventory contains 47 URLs covering login, student modules and test catalogs, results/history, profiles, Trainer evaluation and directory pages, Admin content/accounts/operations, and utility states. Desktop/mobile before-and-after screenshots use isolated fixture preview data. Connected staff workflows are checked separately against a temporary PostgreSQL database. The existing assessment suite covers all three themes and three font sizes across six widths.

## Findings and corrections

| Pages | Findings corrected |
| --- | --- |
| Student, Trainer and Admin login | Password visibility was a disconnected full-row text control. It is now an accessible control inside the password field. Mobile fields use 16px text and 44px controls; the mobile hero no longer stretches into unnecessary empty space. Corrected the damaged apostrophe in the Admin headline. |
| All role shells | Added a clear unread notification count, bounded long header names, two-initial avatars, a sticky header and a footer that stays below short pages. Pending/error banners have page gutters. Collapsed sidebars scroll at short heights while icons and keyboard-focus tooltips remain visible. |
| Student dashboard and practice hub | Badges and icon tiles no longer stretch across cards. Primary card actions align consistently. Helper text contrast and control sizes are improved. |
| Listening, Reading and Writing practice | Larger question-palette targets, accessible checkbox labels, visible search/input focus, aligned selector/action groups and wrapping editor tools improve use on phones. Speaking remains an offline explanation. |
| FLT and Practice Mock catalogs | Eight tests per page retain the full catalog count and existing filters. Single-column mobile cards keep long status labels and actions readable. No attempt, publication or availability rules change. |
| Test instructions and active assessments | Shared control improvements apply without changing timer/recovery rules. Assessment navigation remains reachable on mobile, and theme/font styles remain scoped to tests. |
| Student results, detailed results and history | Shared cards, intrinsic badge widths, action sizes and readable helper text remove inconsistent spacing. Pending and unreleased score behavior remains unchanged. |
| Student profile, leaderboard, notifications and expired access | Existing supplied hierarchy is retained with the shared responsive, contrast and action fixes. |
| Trainer dashboard, student directory and academic profiles | Record cards previously had no desktop styling, producing densely packed plain text. Records now have consistent padding, borders and separation on desktop and mobile; links and statistics are easier to scan. |
| Trainer evaluation queue, evaluation form and profile | Record treatment is consistent with the directory. Peer evaluation panels use balanced columns, and submitted responses/AI feedback have distinct bordered groups. Existing remarks, revision, privacy and release rules remain in place. |
| Admin dashboard, student directory/details and Trainer management | Shared record cards, labels, touch-sized switches, notification indicators and wrapping action groups provide consistent density. Credential and assignment workflows are unchanged. |
| Admin Question Bank | Full-width search/course filters and a responsive advanced-filter disclosure replace a tall mobile filter wall. Questions are paginated by ten, prompt summaries are limited to two lines, and phone actions use a predictable grid. Preview/editor views retain full question text. |
| Question creation and editing | Existing form/preview hierarchy is retained with clearer labels, input focus, file selectors and mobile wrapping. |
| Admin test management | Ten rows per page replace an unbounded 40-row table/card list. Publication and whole-course availability remain separate. |
| Test builder and conversion tables | Long builder labels/actions wrap on mobile. Conversion matrices use a bounded scroll region with a sticky header and readable numeric inputs instead of extending the page by several thousand pixels. |
| Admin/Trainer connected reports | Filters use a compact desktop grid and a collapsible phone panel. Peer comparisons use balanced columns. Workload and submitted assessments have readable mobile cards; missing data gets explicit compact empty states. |
| Settings | Institution/default panels use equal columns; touch-sized switches, input typography and helper contrast are consistent. |
| Media, content imports, operations and audit | Shared file inputs, form/action alignment, record cards, errors and long-text wrapping are applied. These live-only screens are included in connected-mode visual checks. |
| Notifications and announcements | Desktop and mobile recipient records have a consistent card treatment; shared controls and modal headings remain usable on smaller screens. |
| Shared dialogs and loading/error/empty states | Dialog headings stay visible while long content scrolls. Focus restoration and Escape dismissal are verified. Compact empty states are available where repeated large illustrations created unnecessary height. |

## Verification

Required widths: 1440, 1280, 1024, 768, 430 and 390 px. Automated checks cover page-level horizontal overflow, assessment themes/fonts, filter disclosure, catalog pagination, short-height collapsed navigation/tooltips, password visibility, modal focus and connected account/evaluation workflows. Evidence is generated under ignored tmp/design-audit and frontend/test-results, not copied into production content.

The final command results are recorded in docs/VERIFICATION.md after the checks complete. Visual review and Chromium automation do not certify every browser, assistive technology or real-content layout. Licensed assessment media, external AI output and long-form content supplied later require a further visual pass. No real hosted account password is used or included in artifacts.
