# Design System

## Authority and status

The supplied **Google Stitch designs are the primary visual source of truth**. Both source ZIP files were audited on 24 September 2026. A React/TypeScript/Vite frontend preview now implements their selected visual patterns. The original archives and historical audit remain unchanged. See [STITCH_AUDIT.md](STITCH_AUDIT.md) for source IDs, screenshots reviewed, and limitations. Do not invent a replacement visual design or redesign supplied pages without explicit instruction.

This document defines behavioral and consistency standards. Observed colors, fonts, sizes, spacing and patterns are recorded below. Where the exports disagree, retain the discrepancy for deliberate reconciliation rather than guessing a new design. If a supplied screen conflicts with required access, accessibility, or responsive behavior, document the conflict and make the smallest appropriate correction; seek direction for material visual changes.

## Direction

Modern education SaaS: premium, minimal, clean, professional, spacious, and easy to scan. Use strong visual hierarchy, rounded cards, subtle shadows, consistent components, and clear visual status indicators. Prefer short labels, icons, cards, badges, numbers, progress indicators, and charts to explanatory paragraphs. Retain essential assessment instructions and error guidance.

## Foundations

Approved 28 October 2026: use the Admin palette across Admin, Trainer and Student portals. All desktop sidebars, collapsed navigation, mobile drawers and login side panels use the shared navy token `--color-navy` (`#001550`). Active navigation uses `--color-primary-container` (`#2554d7`) with white text in every role. Buttons and other shared controls retain the common primary tokens. This approval supersedes the historical role-specific sidebar/login color differences recorded below.

| Area | Standard |
| --- | --- |
| Typography | Derive font family, weights, and scale from Stitch. Use consistent page-title, section-title, body, label, and supporting-text roles. Preserve readable mobile text and clear numeric scores/timers. |
| Spacing | Extract a reusable spacing scale from Stitch. Apply consistent control gaps, card padding, section spacing, and page gutters; preserve whitespace rather than compressing all desktop content. |
| Layout | Follow supplied page hierarchy and content widths. Use shared Student/Trainer/Admin shells where appropriate, intentional responsive rearrangement, and predictable alignment. |
| Color | Derive brand and neutral tokens from Stitch; define semantic success, warning, error, locked, and informational roles. Never communicate meaning through color alone. |
| Accessibility | Use semantic controls, readable contrast, visible keyboard focus, accessible names, logical focus order, and usable touch targets. Respect reduced-motion preferences. |
| Icons | Use a consistent family/style from the supplied designs. Pair unfamiliar icons with labels or accessible explanations. Decorative icons should not duplicate screen-reader announcements. |

## Components

| Component | Standard |
| --- | --- |
| Cards | Consistent rounded corners, subtle elevation, padding, and hierarchy from Stitch. Keep metric, practice, and mock cards visually related; make click targets unambiguous. |
| Buttons | Establish primary, secondary, quiet, and destructive variants from the design. Provide hover, focus, pressed, loading, and disabled states; use short action labels. |
| Inputs | Persistent accessible labels, clear focus, visible validation, and consistent sizing. Placeholders supplement labels. |
| Forms | Group related fields, explain required formats briefly, preserve entries on errors, and identify field-level and submission-level errors. |
| Tables | Clear headers and aligned values/actions; support readable dense Admin data. Use mobile cards or prioritized columns where appropriate. Avoid page-level horizontal overflow. |
| Tabs | Identify the active tab beyond color. Provide keyboard interaction and clear content association. Keep labels short and usable on narrow screens. |
| Badges | Concise text for course, publication, availability, completion, expiry, and evaluation status. Do not conflate unpublished, locked, disabled, and pending. |
| Toggles | Show label and current state, with keyboard access and save/error feedback. Mock toggles must explicitly apply to all active students in the specified course. |
| Modals | Clear title and purpose, explicit actions, sensible focus placement, focus containment and restoration, and appropriate dismissal. Do not hide essential errors below the viewport. |
| Dropdowns | Consistent trigger and selection styling, keyboard navigation, visible selected state, and placement within the viewport. |
| Progress bars | Show a meaningful label and accessible value. Base percentages on approved progress definitions; do not fabricate completion. |
| Progress rings | Use for concise module summaries with readable numeric/text equivalents. Maintain contrast and legibility at smaller sizes. |
| Charts | Use consistent course/module colors, readable labels, and a text/data alternative. Distinguish no data from zero and avoid unnecessary visual decoration. |
| Tooltips | Brief supplementary labels on hover and keyboard focus. Give collapsed navigation icons accessible names independently of tooltip visibility; do not put essential instructions only in tooltips. |

## Navigation

### Desktop

The sidebar must be collapsible. Expanded navigation shows **icon + label**. Collapsed navigation keeps the **icon visible** and hides the label. **Navigation icons must never disappear when the desktop sidebar is collapsed.**

The active page remains identifiable in both states. Provide tooltips where appropriate, persistent accessible names, and a clearly named expand/collapse control with its current state. Keep focus and navigation usable during transitions.

### Tablet

Use compact/collapsed navigation appropriate to available space. Preserve icons, active-page indication, and accessible labels. Choose transitions after inspecting Stitch and testing actual content widths.

### Mobile

Replace the desktop sidebar with a hamburger-triggered navigation drawer. The desktop sidebar must not consume permanent mobile screen space. The drawer must open/close predictably, support keyboard access and focus restoration, and leave the main content fully usable when closed.

## Responsive behavior

Validate around **1440, 1280, 1024, 768, 430, and 390 px**, as well as widths between those checkpoints. These are validation sizes, not predetermined CSS breakpoints.

- Reflow dashboard metrics and card grids into fewer columns as space decreases.
- Stack forms and action groups intentionally; keep primary actions easy to find.
- Transform tables into readable cards or suitable compact layouts where appropriate. Use contained horizontal scrolling only for data that genuinely requires it.
- Adapt passage/question layouts for narrow screens while preserving question position and answers.
- Keep assessment timers, navigation, audio controls, and writing tools reachable without covering content or being hidden by the mobile keyboard.
- Allow longer labels, errors, zoom, and real student data without clipping. Do not simply shrink the desktop interface.

## States and feedback

| State | Presentation and behavior |
| --- | --- |
| Locked course | Muted styling with lock indicator and short reason. Do not render protected content behind the visual treatment. |
| Locked mock | Clearly locked with course-level unavailability; do not offer an individual unlock request or control. |
| Expired access | Concise access-expired message and office guidance; protected actions unavailable. |
| Disabled control/account | Clearly unavailable with an understandable reason where needed. Distinguish disabled account status from mock availability. |
| Loading | Stable skeletons or progress indicators appropriate to the component. Announce meaningful status and prevent accidental duplicate actions. |
| Empty | Short explanation and relevant next action, such as starting available practice; avoid unnecessary illustrations or paragraphs. |
| Error | Explain what failed and how to recover. Preserve entered answers when possible; avoid exposing internal technical details. |
| Saving/submitting | Make pending, saved, failed, and submitted states distinguishable. Never display success before acknowledgment. |
| Pending evaluation | Explicit pending/unavailable score labels; never substitute zero or an invented band. |

## Observed Stitch tokens and patterns ? Phase 1

Both archives contain a byte-identical `kanan_academic_engine/DESIGN.md`. Its YAML, prose and generated page configurations do not always agree. The following values are observations, not permission to restyle all pages. The shared ZIP 1 configuration and ZIP 2 `_1` practice series are the recommended baseline; approval of variant reconciliation precedes implementation.

| Token/role | Observed baseline |
| --- | --- |
| Primary | #003bb5 |
| Primary container / prominent CTA blue | #2554d7 |
| Background / surface | #f7f9ff |
| White card surface | #ffffff |
| Low surface | #f1f4fb |
| Main text / secondary text | #181c21 / #434654 |
| Outline / subtle outline | #747686 / #c4c5d7 |
| Error / error container | #ba1a1a / #ffdad6 |
| Admin sidebar | #001550 (on-primary-fixed) |
| Headings / labels | Plus Jakarta Sans, typically 600?800 |
| Body | Inter, typically 400?600 |
| Icons | Material Symbols Outlined via Google Fonts; varying fill/weight axes |
| Spacing scale | 4, 8, 16, 24, 32px (space-xs through space-xl) |
| Gutters / margins | Desktop gutter 24px and margin 32px; mobile gutter 12px and margin 16px |
| Header / sidebar | Baseline 64px header, 256px sidebar; several alternatives use 80px headers and 260px rails |
| Card shadow reference | 0 10px 30px -5px rgba(26,54,138,0.05) in exported design prose; actual page shadows vary |

| Type role | Size / line-height / weight |
| --- | --- |
| display-hero / mobile | 40/48/700 and 30/38/700 |
| headline-lg / mobile | 28/36/700 and 22/28/700 |
| headline-md / sm | 20/28/600 and 16/24/600 |
| stat-display | 32/36/800 |
| body-lg / md / sm | 16/26/400, 14/22/400, 12/18/400 |
| label-lg / md / xs | 14/20/600, 12/16/600, 10/14/700 |

Sizes and line heights above are pixels. Baseline generated HTML maps radius DEFAULT/lg/xl to 4/8/12px. Export YAML instead maps DEFAULT/md/lg/xl to 8/12/16/24px, while prose calls for 20?24px cards. ZIP 2 alternatives add further radius overrides. Preserve actual selected screen geometry when consolidating tokens; class names alone do not identify a shared size.

Eight ZIP 2 screens load Tailwind forms/container-queries plugins and omit the baseline named font-size configuration. Several redefine primary as #2554d7 and use alternative canvas colors (#edf1f9, #edf2fb, #f0f4fc). Student Profile/Leaderboard use white navigation, baseline practice uses blue navigation, and Admin uses navy. Treat role differences separately from accidental variant drift.

## Historical source findings

- No complete mobile hamburger/drawer exists. Mobile Dashboard/Practice references use bottom navigation. The required drawer behavior above takes precedence over the exported design prose's optional bottom-navigation direction.
- Reading alternative B06 hides the entire aside on collapse: icons disappear. This violates the required behavior and must not be copied.
- Instructions B04 preserves icons when narrowing the sidebar and hides label spans. Its toggle has a title, but collapsed navigation lacks a complete tooltip/accessibility implementation.
- Writing alternative B11 preserves navigation icons but does not hide all brand/target content when shrinking; overflow and accessible names need correction.
- Most desktop collapse controls are decorative; desktop sidebar offsets persist on small screens despite responsive content grids.
- History B15 contains useful desktop table/mobile card variants. ZIP 1 mobile screens provide intentional stacking and safe-area spacing, but separate screenshots do not establish a unified responsive implementation.
- Pulse/ping, short button scale effects, and SVG ring transitions exist; some generated animation classes have no definition. Add reduced-motion support when implementing.
- Long generated AI/proctor/certification copy and credit/unlock controls conflict with approved scope. Follow PRD.md and the audit's conflict table when replacing placeholder content, preserving the supplied visual hierarchy.

## Validation of the current frontend

The Phase 1 audit reviewed every exported screenshot and inspected source behavior. The October frontend update adds automated Chromium interaction and overflow checks at all six required widths, including all nine assessment theme/font combinations. Cross-browser certification, complete visual parity and real-data UAT remain outstanding. Compare selected sources at 1440, 1280, 1024, 768, 430 and 390px; verify icon-preserving collapse, tooltips, active navigation, accessible mobile drawer, long/empty data, forms/tables, and loading/error states. Resolve variant-specific differences explicitly without a wholesale redesign.

## October 2026 scope additions

Current product behavior follows SOW-KANAN-IELTS-001 v1.0 and PRD.md. Extend existing Stitch cards, tables, badges, forms and navigation for Trainer workflows. Staff workspaces keep the existing visual hierarchy; no replacement design is introduced.

- Separate Practice Mock Tests from Full Length Tests in navigation and management. Only FLTs have course-wide availability toggles. Keep publication and availability visibly independent.
- Speaking cards are muted/disabled with **Speaking is conducted offline by your trainer.** Never show student recording, transcript, microphone-permission or submission controls. Staff can enter the four offline Speaking criteria and date.
- Never show unreleased FLT bands/feedback in student dashboards, history, result URLs or summaries. Pending labels replace unavailable scores. Label released three-skill FLTs **Overall (3 skills) - Speaking pending**; use four-skill labelling after offline marks.
- Trainer assignment filters default to assigned students but provide all-student academic access. Student contacts and account editing do not appear in Trainer screens.
- Score changes require remarks. Draft feedback must not silently replace approved marks. Display revision history and release state independently from AI/review/Speaking state.
- Only module Listening practice offers 1x/1.5x/2x; a new attempt starts at 1x. Full tests show normal speed only.
- Within Practice Mocks/FLTs, Black on white, White on black and Yellow on black combine with Standard, Large and Extra Large text. Defaults are the SOW values pending final design confirmation. Scope styles to the assessment, including passages, questions, instructions and answer inputs; store preferences with the session attempt for resume.
- Do not add a manual Pause button. Clearly distinguish the preview timer/local memory from acknowledged server time and durable saving.

Validate the six required widths and all nine theme/text combinations. Browser preview checks cannot certify server authorization, persistent recovery, production scoring or external integrations.

## Connected application

Live API mode preserves the same Stitch-derived shells and controls. Hide demo role/course switches and reset-on-reload statements in connected mode. Login, save, submission, import and release success must follow server acknowledgment. Surface failed/unsaved states without clearing answers. Student Speaking stays disabled; only staff enter offline marks. Large lists use page controls and additional server batches, with a visible indication when more records exist. Assessment themes/fonts remain scoped to the test and restore from the saved attempt.

The completed management flows reuse these cards/forms/tables for reports, private media, announcements and interruption review. Live UI labels describe acknowledged server actions; sample/preview wording is restricted to explicit demo flows. Submitted sections have disabled navigation. Reading passage changes follow the saved question position. New report/operations pages join the six-width regression matrix.

Original question titles retain their authorship label. External official-resource cards have been removed from module practice and Admin content import at the user?s request.


## October 28 design correction pass

The page-by-page review is recorded in [docs/DESIGN_REVIEW.md](docs/DESIGN_REVIEW.md). Keep the existing Stitch-derived visual hierarchy. Shared record cards must have consistent desktop and mobile styling; badge/icon widths follow their content. Mobile controls use at least 44px interactive targets and 16px input text, while the visual switch track can remain smaller inside its touch target. Long header names truncate without expanding the header. A collapsed sidebar must scroll on short displays without clipping its active icon or focused tooltip.

Dense filters may use a native accessible disclosure: open by default on desktop and collapsed on mobile. Catalogs keep their full counts while showing bounded pages (eight student tests, ten Admin tests/questions). Use mobile cards for report records; keep genuine data matrices such as band conversions in a labelled, keyboard-scrollable region with a sticky header. Dialog headings stay visible within long scrolling forms. Preserve assessment theme/font scope and all existing save/release/access behavior.

## Current sign-in decision - 28 October 2026

Every role login contains only an email/assigned-ID input and password, with show/hide and Sign in. Remove authenticator setup, code entry and recovery acknowledgements. Sensitive staff-action dialogs request only the password. Preserve the shared Admin navy palette and existing responsive login layout. Accounts remain Admin-created; do not introduce public signup or Student reset controls.
