# Design System

## Authority and status

The supplied **Google Stitch designs are the primary visual source of truth**. The two source ZIP files have not yet been imported or audited. Do not invent a replacement visual design or redesign supplied pages without explicit instruction.

This document defines behavioral and consistency standards. Exact colors, fonts, sizes, spacing values, radii, shadows, icon family, chart styling, and breakpoints must be extracted from the Stitch audit rather than guessed. If a supplied screen conflicts with required access, accessibility, or responsive behavior, document the conflict and make the smallest appropriate correction; seek direction for material visual changes.

## Direction

Modern education SaaS: premium, minimal, clean, professional, spacious, and easy to scan. Use strong visual hierarchy, rounded cards, subtle shadows, consistent components, and clear visual status indicators. Prefer short labels, icons, cards, badges, numbers, progress indicators, and charts to explanatory paragraphs. Retain essential assessment instructions and error guidance.

## Foundations

| Area | Standard |
| --- | --- |
| Typography | Derive font family, weights, and scale from Stitch. Use consistent page-title, section-title, body, label, and supporting-text roles. Preserve readable mobile text and clear numeric scores/timers. |
| Spacing | Extract a reusable spacing scale from Stitch. Apply consistent control gaps, card padding, section spacing, and page gutters; preserve whitespace rather than compressing all desktop content. |
| Layout | Follow supplied page hierarchy and content widths. Use shared student/Admin shells where appropriate, intentional responsive rearrangement, and predictable alignment. |
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
- Keep assessment timers, navigation, audio controls, writing tools, and recording actions reachable without covering content or being hidden by the mobile keyboard.
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

## Audit and validation

After the two Stitch ZIP files are authorized for import, inventory student/Admin screens, map reusable components and design tokens, identify missing states, and record responsive behavior. Update this document with observed values and reference locations. Validate future screens against Stitch at the target widths and test collapsed navigation, mobile drawer behavior, keyboard use, loading/errors, and long/empty data.
