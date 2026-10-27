# Phase 1 — Stitch Source Audit and Merge Plan

Audit date: 24 September 2026. **Inspection and planning only; no application changes or merge performed.** PRD.md remains authoritative for product behavior; supplied Stitch screens remain the visual references.

## 1. Inputs, method, and limits

| ID | Archive in `stitch-imports/` | Contents |
| --- | --- | --- |
| ZIP 1 | `stitch_kanan_ielts_learning_portal (1).zip` | 15 HTML screens, 15 PNG screenshots, one DESIGN.md: 31 files. |
| ZIP 2 | `stitch_kanan_ielts_learning_portal (2).zip` | 15 HTML screens, 16 PNG screenshots (including one inspiration image), one DESIGN.md: 32 files. |

Both use the internal root `stitch_kanan_ielts_learning_portal/`. Each screen directory contains `code.html` and `screen.png`; `kanan_academic_engine/DESIGN.md` contains the exported design specification. There is no application root entry point.

Archives were checked for unsafe paths and symbolic links, then extracted separately to `C:/Users/asus2/AppData/Local/Temp/kanan-stitch-audit-dm2unoxy/zip1` and `zip2`. Analysis artifacts live outside those source directories. Every extracted source file was compared byte-for-byte to its archive member after inspection; both archives' hashes were unchanged.

| Archive | SHA-256 |
| --- | --- |
| ZIP 1 | `0a8fa0d366b59318528a493bcf9809cabc9d35194adb31d692e78d3183385060` |
| ZIP 2 | `36d87abe746154623e2af7a46f48dd7ed803f1a40cad8f69f425b2ee1b3f39f5` |

All 30 HTML files were inspected for markup, content, configuration, scripts, references, layout, controls, and placeholders. All 31 supplied PNGs were visually reviewed in contact sheets. Both design files were inspected/compared. Asset URLs were checked over HTTP. This is a source and exported-screenshot audit, **not a live browser interaction or six-viewport rendering test**. Runtime accessibility, overflow, and CDN-generated rendering still require testing after an approved implementation. No dependencies were installed or application scripts executed.

## 2. Actual technology stacks

| Area | ZIP 1 | ZIP 2 |
| --- | --- | --- |
| Framework | None detected; standalone HTML documents. | Same. |
| Language | HTML, inline CSS, vanilla browser JavaScript. | Same; no TypeScript. |
| Package manager / Node | No package.json, lockfile, engine declaration, or Node requirement. | Same. |
| Build tool / commands | None; no install/dev/build scripts. | Same. |
| Styling | Tailwind CDN plus per-page `tailwind.config` and inline styles. | Same; several screens request `?plugins=forms,container-queries`. |
| Dependency versions | CDN URL is unpinned; no reproducible version metadata. | Unpinned CDN; plugin versions not declared. |
| Fonts / icons | Google Fonts: Inter, Plus Jakarta Sans, Material Symbols Outlined. Repeated icon-font links occur. | Same families, varying requested weights/axes and repeated links. |
| Routes / entry points | Each `code.html` opens independently. 101 anchors use `#`; one local fragment and one mailto link. No router. | Each `code.html` independently; all 126 anchors use `#`. No router. |
| Components / layouts | Repeated inline sidebar, header, cards, controls; no imported/shared component files. | Same, with several alternative student shells. |
| State management | Native control/DOM state, local JS variables, timers, class changes; no shared store or durable answer storage. | Same. |
| API / auth / backend / database | None. Admin credential display/reset is a visual demonstration. | None. Exam and evaluation claims are placeholders. |
| Charts | Inline SVG rings/paths and CSS bar/metric displays; hardcoded values. | Same; no chart library. |
| Forms / tables | Native inputs/selects; one actual enrollment form. Tables in Admin dashboard, student details, student management, mock management, and leaderboard. | Native inputs/selects/textareas; history table with separate mobile cards. Writing/Speaking editors are not complete submission workflows. |
| Media | Remote images; no bundled audio, recordings, fonts, or video. | Same. Instructions synthesize a short Web Audio calibration tone; that is not assessment audio. |

There is no package-version conflict to resolve from manifests because no manifests exist. Both exports are compatible as HTML references, but neither is a ready-to-run application scaffold. Install command: **not applicable**. Development command: **none supplied**. Build command: **not applicable**. Opening a `code.html` in a browser previews an individual screen with network-dependent styling/media; it does not start a portal.

## 3. Complete source inventory

Paths below are relative to each ZIP's `stitch_kanan_ielts_learning_portal/`. Each numbered screen maps to `<directory>/code.html` and its companion `screen.png`. These IDs are used in the coverage and merge tables.

### ZIP 1

| ID | Directory | What exists / limitation |
| --- | --- | --- |
| A01 | `admin_dashboard_kanan_ielts_portal` | Admin overview, stats, charts, recent students, evaluation queue; static. |
| A02 | `admin_results_and_reports_kanan_ielts_admin` | Combined results/reports, diagnostics and cohort charts; tab styling interaction only. |
| A03 | `admin_student_details_kanan_ielts_admin` | Student details, course lock/reallocation CTA, result history; reveals/copies a fixed example credential, not a password reset. |
| A04 | `create_new_question_kanan_ielts_admin` | Question authoring/preview, module selectors, sample Listening item; play button changes icon only. |
| A05 | `ielts_mock_exam_listening_mobile_view` | Mobile Listening mock section, countdown, flags, answer styling, palette/proctor modals; save badge is simulated, navigation logs to console. |
| A06 | `ielts_practice_hub_mobile_view` | Mobile module cards, search, launch toast; bottom navigation, no drawer. |
| A07 | `ielts_student_leaderboard_kanan_portal` | Rankings, podium, filters, table; static and overexposes candidate details. |
| A08 | `ielts_test_result_mobile_view` | Mobile result summary; Academic badge differs from General desktop result. |
| A09 | `mock_test_builder_kanan_ielts_admin` | Writing configuration step, Task 1/2 textareas, section stepper, publication CTA; other steps not implemented. |
| A10 | `mock_test_management_kanan_ielts_admin` | Mixed-course six-row catalog, access toggles, cohort/scheduled access concepts; not two independent 40-test lists. |
| A11 | `platform_settings_kanan_ielts_admin` | Settings inputs/toggles and success toast; reset restores only selected fields, no persistence. |
| A12 | `question_bank_kanan_ielts_admin` | Four-module repository, filters, item cards, preview/edit affordances; tabs change styling without data filtering. |
| A13 | `student_dashboard_mobile_view` | Mobile dashboard, resume, progress, upcoming evaluations, recent mocks; bottom navigation. |
| A14 | `student_management_kanan_ielts_admin` | Student table and enrollment modal; submit prevents default and closes modal without creating a student. |
| A15 | `student_profile_course_access_kanan_ielts_portal` | Profile/read-only dossier, access period, active/locked course cards. |

### ZIP 2

| ID | Directory | What exists / limitation |
| --- | --- | --- |
| B01 | `ielts_listening_practice_kanan_portal_1` | General shell, transcript, questions 11–20, randomized waveform animation; no real playback. |
| B02 | `ielts_listening_practice_kanan_portal_2` | Alternative Listening layout/content, CSS floorplan, controls; no application logic. |
| B03 | `ielts_mock_exam_section_1_listening` | Desktop examination shell, Listening questions/palette; static timer/save status, no full test flow. |
| B04 | `ielts_mock_test_06_instructions` | Instructions, agreement-gated launch button, collapsible sidebar, calibration modal and actual synthesized tone; launch does not navigate. |
| B05 | `ielts_reading_practice_kanan_portal_1` | General transport passage/questions; font sizing, countdown, pre-existing highlight visibility toggle. |
| B06 | `ielts_reading_practice_kanan_portal_2` | Alternative renewable-energy passage/questions; selection highlighting and font controls; collapse hides the whole sidebar. |
| B07 | `ielts_speaking_practice_kanan_portal_1` | Part 2 transport cue, scratchpad, recording/AI visuals; no microphone or recording code. |
| B08 | `ielts_speaking_practice_kanan_portal_2` | Alternative Part 2 tourism cue, input selector, recording/AI visuals; reset confirmation only. |
| B09 | `ielts_test_result_mock_test_06` | Desktop result, skill breakdown, feedback and charts; detailed-answer CTA has no destination. |
| B10 | `ielts_writing_practice_kanan_portal_1` | General Task 1 letter, textarea, live word/character count, prompt collapse, clear, fullscreen, countdown. |
| B11 | `ielts_writing_practice_kanan_portal_2` | Alternative letter editor with counts, ring, sidebar collapse, timer/task button styling, simulated save; no separate Task 2 content/state. |
| B12 | `student_dashboard_kanan_ielts_portal` | Academic-oriented dashboard variant, course buttons, schedules/mentors; static. |
| B13 | `student_dashboard_kanan_ielts_portal_general_training` | General dashboard, expiry, module progress, mock cards, recent results; strongest student dashboard coverage. |
| B14 | `student_practice_kanan_ielts_portal` | Desktop practice hub and filters; only sidebar active styling is scripted. |
| B15 | `test_history_kanan_ielts_portal` | Test history, stats, table and mobile cards; no filtering/export/pagination logic. |

### Shared / layout and utility / other

| Item | Status | Notes |
| --- | --- | --- |
| `kanan_academic_engine/DESIGN.md` | FOUND IN BOTH | Byte-identical exported design spec; keep one canonical reference after approval. |
| Sidebar / header / dashboard shell markup | FOUND IN BOTH | Repeated markup, not shared components. Separate Admin and student variants. |
| Examination shell | FOUND IN BOTH | A05 mobile and B03 desktop; different question fixtures. |
| `dashboard_ui_design_for_education_platform_daniia_dikaia.jpg/screen.png` | FOUND IN ZIP 2 | Inspiration screenshot only; despite directory suffix, no JPEG or HTML file exists here. Not a portal page to implement. |
| Enrollment modal | FOUND IN ZIP 1 | A14; useful create-student reference, incomplete required fields/behavior. |
| Calibration modal | FOUND IN ZIP 2 | B04; useful audio-test reference, not a working microphone readiness check. |
| Proctor help / question palette | FOUND IN ZIP 1 | A05; palette may inform exam navigation. Proctor service is outside confirmed scope. |
| Loading / empty / error / not-found pages | MISSING | Isolated toasts and muted controls do not supply complete states. |

## 4. PRD page coverage

FOUND means a visual reference exists, **not** a complete functioning feature. Partial references and missing flows are explicitly listed. ALTERNATIVE VERSION EXISTS identifies variant-only coverage or additional variants without claiming a new completed route.

### Student portal

| Required page/state | Status | Sources and gaps |
| --- | --- | --- |
| Student Login | MISSING | No credential-entry screen. |
| Dashboard | FOUND IN BOTH | A13 mobile; B13 General and B12 Academic alternative. |
| Practice | FOUND IN BOTH | A06 mobile, B14 desktop. |
| Listening Practice | FOUND IN ZIP 2 | B01; ALTERNATIVE VERSION EXISTS: B02. No actual audio. |
| Reading Practice | FOUND IN ZIP 2 | B05; ALTERNATIVE VERSION EXISTS: B06. Different passages, not interchangeable course fixtures without review. |
| Writing Practice | FOUND IN ZIP 2 | B10; ALTERNATIVE VERSION EXISTS: B11. General Task 1 only in working editor content; Task 2 and Academic Task 1 need completion. |
| Speaking Practice | FOUND IN ZIP 2 | B07; ALTERNATIVE VERSION EXISTS: B08. Part 2 only; Parts 1/3 and recording/submission missing. |
| Mock Tests | MISSING | Dashboard mock cards in A13/B13 are partial references, not a full student catalog. |
| Mock Test Instructions | FOUND IN ZIP 2 | B04; timings/readiness/AI claims are unapproved placeholders. |
| Full Mock Test Interface | FOUND IN BOTH | A05/B03 supply only Listening section shells; complete four-section flow, transitions, recovery and submission are missing. |
| Mock Test Result | FOUND IN BOTH | A08/B09; inconsistent course fixtures and static scores. |
| Test History | FOUND IN ZIP 2 | B15; mobile-card variant embedded. |
| Detailed Result | MISSING | B09 includes score detail/feedback but no answer-level review destination or complete review screen. |
| Leaderboard | FOUND IN ZIP 1 | A07; weekly/monthly/all-time controls are visual only. |
| Profile | FOUND IN ZIP 1 | A15. |
| Locked Course State | FOUND IN ZIP 1 | Embedded in A15; no standalone state page. |
| Expired Access State | MISSING | Expiry labels do not provide an expired-access block screen. |

### Admin portal

| Required page/feature | Status | Sources and gaps |
| --- | --- | --- |
| Admin Login | MISSING | No Admin authentication screen. |
| Admin Dashboard | FOUND IN ZIP 1 | A01. |
| Student Management | FOUND IN ZIP 1 | A14, including enrollment modal; date/credential management incomplete. |
| Student Details | FOUND IN ZIP 1 | A03; edit/date/status controls are incomplete demonstrations. |
| Course Assignment | ALTERNATIVE VERSION EXISTS | A14 enrollment course selector and A03 reallocation CTA; no complete standalone assignment/change flow. |
| Question Bank | FOUND IN ZIP 1 | A12. |
| Create Question | FOUND IN ZIP 1 | A04, currently a Listening example; all module authoring workflows need completion. |
| Edit Question | MISSING | A12 has Edit actions; A04 may later share the editor, but no edit screen exists. |
| Mock Test Management | FOUND IN ZIP 1 | A10 must be aligned with separate course catalogs, 40 each, and course-level toggles. |
| Mock Test Builder | FOUND IN ZIP 1 | A09 Writing step only. |
| Results | FOUND IN ZIP 1 | Combined A02 aggregate screen; per-student results listing/detail workflows need completion. |
| Reports | FOUND IN ZIP 1 | Combined A02. Export controls do not generate files. |
| Settings | FOUND IN ZIP 1 | A11; several settings exceed scope or conflict with fixed rules. |

## 5. Base recommendation and comparison

**Use ZIP 1 as the primary source baseline**, not as an existing runnable application. It has one consistent color/type configuration across all 15 screens, a repeatable Admin shell across nine pages, and mobile/profile/leaderboard references that complement ZIP 2. ZIP 2 provides the essential desktop student assessment content, but has substantially more competing shell, branding, spacing, and token variants.

| Criterion | Assessment |
| --- | --- |
| Maintainability / reuse | Neither has component modules. ZIP 1's consistent Admin markup and configuration are easier to consolidate without mixing incompatible visual variants. |
| Code quality | Both are generated standalone documents with placeholder links and scripts. Neither supplies production state, validation, routing, or persistence. |
| Completeness | ZIP 1 covers administration; ZIP 2 covers desktop practice/exams. Neither is complete alone. Both contain 15 HTML screens, so page count does not determine the choice. |
| Routing | Equal: no router in either. |
| Responsive implementation | ZIP 1 includes four purposeful mobile references; most desktop shells in both lack working mobile navigation. ZIP 2 history has useful table-to-card behavior. |
| Design consistency | ZIP 1 is stronger on token consistency; ZIP 2's `_1` practice series and General dashboard closely match that family. |
| Merge effort | Use ZIP 1 tokens/Admin pages and ZIP 2 `_1` student series. Keep `_2` screens as visual/content alternatives rather than merging conflicting global styles. |

No literal page-directory collision exists across the archives except their shared root and `kanan_academic_engine` directory. Every screen file is called `code.html`/`screen.png`, so flattening directories would overwrite files. The only byte-identical file found across all inputs is DESIGN.md; screenshots and HTML are not exact duplicates. Semantic duplicates still require deliberate page selection.

## 6. Visual and responsive audit

| Area | Observed consistency / conflict |
| --- | --- |
| Typography | Inter body and Plus Jakarta Sans headings/labels throughout. ZIP 1 and ZIP 2 `_1` series define a full named font-size scale. Eight other ZIP 2 pages omit that scale and use conventional/arbitrary sizes. Requested font weights differ. |
| Colors | Shared export YAML uses primary `#003bb5`, primary-container `#2554d7`, canvas `#f7f9ff`. Several ZIP 2 pages redefine primary as `#2554d7` and canvas as `#edf1f9`, `#edf2fb`, or `#f0f4fc`. Admin sidebar is navy; A07/A15 use white; student variants use multiple royal blues. |
| Cards / radii / shadows | Common rounded white panels, tinted surfaces, subtle shadows. Export prose/YAML and HTML radius names disagree; many ZIP 2 variants use larger outer frames, 20–28px radii, and stronger shadows. Do not equate identically named classes without comparing computed values. |
| Buttons / forms | Consistent pill CTAs and soft inputs broadly, but height, radius, border and font treatment vary. CDN forms plugin is present only on eight ZIP 2 pages and can change control appearance globally. |
| Tables | ZIP 1 uses dense Admin/leaderboard data and horizontal table containers; B15 adds separate mobile cards. This is reusable behavior, but its persistent sidebar still prevents full mobile compliance. |
| Tabs / toggles | Mostly static styling. A02/A12 tabs change appearance; native checkboxes handle local state. No availability service or state shared between courses. |
| Headers / widths | Fixed 64px headers and 256px sidebars in baseline; alternatives use 80px headers, 260px rails, framed canvases and widths up to 1540px. Baseline content often uses max-w-7xl. |
| Sidebar expanded | Icons and labels are present. Active styling is hardcoded or set by small DOM scripts. Nav item sets differ, with missing Leaderboard in baseline student nav and out-of-scope Schedule/Forum/Materials items in alternatives. |
| Sidebar collapsed | Most toggles are decorative. B04 narrows 256 to 80px and hides labels while retaining icons, with a titled toggle, but without complete collapsed-navigation tooltips/accessibility. B11 similarly keeps navigation icons, but brand/target content is not hidden and can overflow; navigation tooltip/accessibility coverage is incomplete. **B06 toggles `hidden` on the entire aside, removing icons and its own collapse control.** |
| Mobile navigation | No working hamburger/drawer found. A06/A13 use bottom navigation; A05/A08 use compact assessment/result headers. Mobile references do not satisfy the required portal drawer on their own. |
| Responsive layouts | sm/md/lg/xl utilities adjust grids and text, but fixed desktop sidebar offsets remain. A05/A06/A08/A13 use width:100vw and a minimum body height of max(884px,100dvh); they are independent mobile screens, not connected responsive variants. |
| Motion | Tailwind pulse/ping, hover transitions, short button scale changes, randomized B01 waveform, B11 SVG ring transition. Some classes such as `animate-fadeIn`, `animate-in`, `fade-in`, `zoom-in` lack matching definitions/plugins in the archives. No reduced-motion handling found. |
| Accessibility | Icon-only buttons, clickable non-semantic answer wrappers, modal focus behavior, global hidden scrollbars, collapsed labels, status announcements and color contrast need runtime verification/remediation. No complete keyboard/focus-managed drawer exists. |

Visually divergent screens: A07/A15's white student sidebar versus blue desktop practice; B12's Smart-branded Academic dashboard versus B13's KANAN General dashboard; B02/B06/B08's Academic Engine shell; B11's Smart IELTS framed editor; B04/B15 framed layouts; B09's different result canvas/header. Preserve these as references and normalize only approved shared patterns. Do not replace layouts wholesale.

The six required widths (1440/1280/1024/768/430/390) remain a future live validation matrix. Source review identifies missing behavior; exported PNGs cannot prove responsive interactions.

## 7. Broken references, incomplete code, and assets

- No module imports exist, so no broken ES-module imports were found. Static literal `getElementById` references resolved and no duplicate IDs were detected within individual pages. This does not certify dynamically constructed selectors or runtime correctness. Global function/variable names would collide if whole documents were concatenated.
- No missing local image/script/stylesheet reference was found. `screen.png` files are design references, not runtime assets used by the HTML.
- There are 26 unique remote image URLs in ZIP 1, seven in ZIP 2, two shared: **31 distinct remote image URLs**. On the audit date, 28 returned HTTP 200 to HEAD; three returned HTTP 403 to both HEAD and GET. This is reachability evidence, not proof of browser rendering or future availability.
- Failed URL identifiers: `AEtjO1XwDfJ…` (shared brand image, all ZIP 1 pages and B01/B05/B07/B10/B13/B14); `AEtjO1XJoGL…` (Admin avatar, all nine Admin pages); `AEtjO1VMN20…` (student avatar in A05/A06/A07/A08/A13/A15/B04/B09/B12/B15). Full URLs remain in the corresponding `img src` attributes. No replacement images were created or downloaded into the repository.
- Fonts/icons and Tailwind depend on external providers; no offline fallback asset bundle or pinned CSS build exists. Asset licensing/provenance and local hosting need review before production.
- No Listening audio file or actual Speaking recording stream is supplied. Displayed MP3 filenames, waveforms, device readiness and microphone statistics are placeholders. B04's oscillator tone only checks audible output.
- B11 simulates cloud-save success without saving, estimates vocabulary with word uniqueness, resets its countdown when switching tasks, and retains a 150-word target/content. Its rich-formatting buttons call `execCommand` on a textarea and do not provide a proper rich-text editor.
- A05 save badges and proctor alerts are simulations; B03 has static exam timing and no next-section submission workflow. Native inputs do not equal persisted answers.
- A14 closes its enrollment modal without creating a record. A03 reveals a fixed demo credential. A11 shows a save toast without applying durable settings. These must never be treated as implemented authentication or administration.

## 8. Business-rule and scope conflicts to resolve before implementation

| Evidence | Required treatment in an approved merge |
| --- | --- |
| A03/A14 per-student mock credits, allocation, bulk credit controls; A15 fully-unlocked count | Eliminate individual access entitlements from the planned data/UI model. Completion counts are valid; student-specific unlock balances are not. |
| A10 cohort targeting, scheduled unlocks, mixed diagnostic/express catalog and 24-test count | Plan separate General/Academic sections with exactly 40 each; independent course/test availability, publication separate. Cohort access must not become an authorization layer. |
| B13 “Requires Mock #5” lock | Replace prerequisite unlocking with the relevant course-level availability reason. |
| A15 “switch or dual-enroll” | Permit only Admin-controlled reassignment to one course. |
| A11 configurable “Disable Student Self-Serve Resets” | Student self-reset prohibition is a fixed business rule, not an optional toggle. |
| B12 freely presented course buttons; General labels on Academic-styled content | Bind display and content eligibility to the assigned course; other course locked. Audit content eligibility instead of inferring it from titles. |
| AI scoring, instant evaluation, proctoring, webcam/tab-lock, mentor queues, certification claims throughout | Not implemented and not automatically in scope. Manual/AI evaluation is future capability. Do not ship invented readiness, accreditation, grading, or live service claims. |
| A07 full names, candidate IDs, centers, skill breakdowns | Define minimal ranking identity/fields before leaderboard release; protect private details. |
| Demo dates, raw/band scores and totals disagree | Use coherent fixtures with pending evaluation states; scoring/timing rules still need product confirmation. Do not accept generated instructional claims as verified exam policy. |

These are planned corrections, not changes made to the exports. No PRD rule has been weakened to fit generated content.

## 9. Static data and future service boundaries

All screen data is embedded in HTML attributes/text, SVG geometry/CSS dimensions, or small JS literals. There are no mock-data modules or services yet. The inventory covers every screen below; visible “live”, “synced”, “saved” and “AI” labels do not indicate integrations.

| Sources | Static data categories | Proposed frontend boundary |
| --- | --- | --- |
| All portal headers/sidebars; A03/A13/A15/B12/B13 | Identity, Student IDs, avatars, course, goals, access dates, streaks, mentor/contact information, notification indicators | `studentService`: profile/access summary; future session identity supplied separately. |
| A13/B12/B13/B14/A06 | Skill progress, activity, mock cards, recent results, recommendations, schedules | `progressService` and `practiceService`; omit unapproved scheduler/AI services. |
| B01/B02/B05/B06/B07/B08/B10/B11/A04 | Passages, transcripts, prompts, cue cards, options, prefilled answers, timing, word targets, media metadata, sample metrics | `practiceService` / `questionBankService`; course-qualified fixtures. |
| A05/B03/B04/A09/A10 | Mock metadata, sections, question palettes, availability/publication, duration and readiness labels | `mockTestService`; `attemptService` for answers/lifecycle later. Readiness must come from real device checks when implemented. |
| A08/B09/B15/A03 | Attempt names/dates, time taken, raw scores/bands, feedback, histories/charts | `resultService`, explicit pending/evaluated states; no fabricated AI results. |
| A07 | Period/cohort filters, ranks, identities, scores, trends | `leaderboardService`, course scope and approved public fields only. |
| A01/A02 | Institutional stats, activity bars, queue counts, cohorts, distributions and reports | `adminReportService`; approved metrics only. |
| A03/A14 | Student rows, dates/status, enrollment selectors, credential demo | `adminStudentService`; real credential operations deferred to backend/auth phase. |
| A04/A12 | Question catalog, module/format/eligibility filters, tags, answer keys and preview | `questionBankService`; keep Admin answer keys out of student payloads later. |
| A09/A10 | Builder prompts, catalog rows, status/access toggles | `mockTestService`; one course/test availability record, never per student. |
| A11 | Institution/support settings, toggles, sample audit footer | `settingsService`; only approved settings and no simulated persistence claims. |

Future flow: page/component → frontend service → explicit mock fixture adapter. Later replace adapter with backend API calls, preserving service contracts. UI-only toggles, active tabs and drafts can be local state; server-authoritative access, timing, save acknowledgment and scoring must not be faked as production behavior. Do not add services, mocks or backend code during this audit.

## 10. Reusable components and proposed structure

No existing component module can be “retained”; the following are candidates to extract from the selected markup after approval:

| Candidate | Source / reason |
| --- | --- |
| AppShell, StudentLayout, AdminLayout, ExamLayout | Shared structure; A01 Admin, B13 student, A05/B03 exam. Keep role-specific navigation. |
| Sidebar, Header, PageHeader | Repeated on most screens; use B04's icon-preserving collapse concept with proper drawer/focus behavior. |
| Button, Card, Badge, Input, Select, Toggle, Tabs | Common visual/control patterns; consolidate only actual repeated variants. |
| ModuleCard / ProgressCard | A06/B14 and dashboards; reusable module metrics/rings. |
| MockTestCard / LockedState | B13 mock cards and A15 course lock; distinct course and mock reasons. |
| ResultCard / ScoreBreakdown | A08/B09/B15; shared scores and pending states. |
| Table, Search, Pagination | A14/A10/A07/B15; keep domain-specific columns local and reuse container/control behavior. |
| Modal | A14 enrollment, B04 calibration, A05 palette; shared accessible mechanics, local content. |
| EmptyState / LoadingState / ErrorState | Missing designs/behaviors to complete using approved tokens. |
| Question navigation, timer display, answer controls | Shared practice/exam pieces where policies match; no giant universal assessment component. |

Do not componentize one-off decorative charts or every wrapper. Extract repeated structure as it becomes useful.

Because actual source technology is HTML/CSS/vanilla JS, the proposed structure is framework-neutral with browser JavaScript modules and JSDoc type contracts. It is a plan, not a selected React/Vite/TypeScript stack or a created directory tree. A future scaffold/build/router choice requires an explicit implementation decision.

```text
frontend/                         # proposed only
  index.html                      # future application entry
  src/
    main.js
    layouts/                      # app, student, admin, exam
    components/                   # common controls and repeated domain UI
    pages/
      student/
      admin/
      utility/
    routes/                       # route registry and navigation
    types/                        # JSDoc domain/service contracts
    mocks/                        # coherent course-qualified fixtures
    services/                     # frontend service contracts/adapters
    assets/                       # approved images/icons/fonts
    styles/                       # shared tokens, base, component styles
    utils/
  tests/                          # when test tooling is chosen
```

## 11. Exact proposed merge and route strategy

1. Keep both original ZIPs immutable. After implementation approval, choose/pin the application tooling separately; there is no package-based project to copy and run. Use ZIP 1 as the primary reference baseline and retain its DESIGN.md as the single exported specification reference.
2. Extract shared tokens and layout markup deliberately; never concatenate full HTML documents. Keep page-specific content, strip duplicate document wrappers/CDN/config/font tags only in the new application, and scope migrated scripts to their owning page with event/timer cleanup.
3. Carry A01–A04, A07, A09–A12, A14–A15 into their mapped Admin/student views below, subject to the explicitly listed PRD corrections. Use A05/A06/A08/A13 as mobile behavior/layout references for the corresponding unified pages, not separate mobile URLs.
4. Import **B01, B03, B04, B05, B07, B09, B10, B12, B13, B14 and B15** from ZIP 2. Use B13's layout family as the default student shell. Keep B12 as the Academic dashboard visual/content reference within the same dashboard route; do not preserve an unrestricted course switch.
5. Keep B02/B06/B08/B11 archived as alternative references. Their unique floorplan, passage and cue content may become reviewed fixtures later; they are not duplicate content to discard blindly. B04 supplies the better collapse concept; do not import B06's whole-sidebar hiding or B11's fake saves/AI estimates. No alternative files are deleted now.
6. Once parity is verified, remove only redundant copies from the future runtime: repeated headers/sidebar/config/fonts, duplicate DESIGN.md, extra desktop alternative pages, separate mobile page copies, and the inspiration screenshot as a runtime asset. Preserve original ZIPs and source mapping for review.
7. Reconcile Tailwind/form-control styling and font requests in one approved configuration. Pin dependency versions only after tooling selection. Preserve navy Admin versus blue student role styling where intended; record approval for variant changes. Restore failed logo/avatar assets with authorized originals or approved fallbacks.
8. Add the planned routes below, shared fixture-backed services, and missing screens in the approved frontend phase. Do not implement authentication/backend/Prisma/database as part of a frontend merge. Preview role/course state must be clearly mock-only.
9. Validate all required pages, state/route transitions, truthful save/evaluation feedback, course-level availability fixtures, and visual parity at six widths before considering the merge complete.

Every route below is **new**, not discovered in either ZIP. Student and Admin namespaces prevent ambiguous Dashboard/Results/Settings names. Parameter names are conceptual; course/test identifiers must be unambiguous.

| Proposed route | Source / planned handling |
| --- | --- |
| `/student/login` | Missing screen; design needed. No forgot-password/self-registration links. |
| `/student/dashboard` | B13 default shell; B12 Academic reference; A13 mobile. |
| `/student/practice` | B14 + A06 mobile. |
| `/student/practice/listening/:practiceId` | B01; B02 alternative retained outside runtime. |
| `/student/practice/reading/:practiceId` | B05; B06 alternative content/reference. |
| `/student/practice/writing/:practiceId` | B10; complete Task 2/Academic requirements later. |
| `/student/practice/speaking/:practiceId` | B07; complete Parts 1/3 and recording later. |
| `/student/mock-tests` | Missing full catalog; reuse B13 mock-card pattern and course-level status. |
| `/student/mock-tests/:courseId/:testId/instructions` | B04. Course parameter is not authorization. |
| `/student/attempts/:attemptId` | B03 + A05 mobile; missing sections and lifecycle work. |
| `/student/results/:attemptId` | B09 + A08 mobile; coherent course fixture. |
| `/student/results/:attemptId/details` | Missing answer-review page; release policy unresolved. |
| `/student/history` | B15 table/card presentation. |
| `/student/leaderboard` | A07; course scope/minimal identity. |
| `/student/profile` | A15 with embedded locked-course state. |
| `/student/access-expired` | Missing state page; protected actions unavailable. |
| `/admin/login` | Missing screen. Authentication deferred. |
| `/admin/dashboard` | A01. |
| `/admin/students` | A14 with enrollment modal. |
| `/admin/students/:studentId` | A03; course-assignment dialog/section informed by A14 selectors; no extra route required. |
| `/admin/questions` | A12. |
| `/admin/questions/new` | A04; shared editor to be completed for all modules. |
| `/admin/questions/:questionId/edit` | Missing edit mode, reuse approved A04 editor. |
| `/admin/mock-tests` | A10 corrected to independent General/Academic sections, 40 each. |
| `/admin/mock-tests/:courseId/:testId/builder` | A09; missing builder steps completed later. |
| `/admin/results` and `/admin/reports` | A02 shared reporting layout; results listing/detail completeness to be addressed. |
| `/admin/settings` | A11 with only approved settings. |
| Unmatched route | Missing not-found state. |

## 12. Documentation updates, remaining risks, and stop point

Updated ARCHITECTURE.md with the actual source stack, absence of app routing/build tooling, proposed structure, and service/merge direction. Updated README.md with audited status and truthful command availability. Updated DESIGN_SYSTEM.md with observed tokens, variants, and sidebar/responsive defects. Added this report for complete inventory, evidence, and merge mapping. PRD.md and AGENTS.md were not changed.

Before merging: obtain implementation approval; settle missing-screen designs and the frontend scaffold; reconcile the listed business-rule conflicts and visual alternatives; recover failed assets; define assessment timing/scoring/recovery and result-release policy for dependent work. The exports do not provide working authentication, secure access, durable saving, scoring, media playback/recording, or complete examination flows. Backend, database, and authentication remain separate future work.

**Audit complete. Stop here. No source merge, deletion, redesign, package installation, authentication implementation, backend, Prisma, or database work was performed.**
