import { useId, useState } from "react";
import { usePreview } from "../app/PreviewContext";
import type { PreviewValue } from "../app/context";
import { NavLink, Link, useLocation } from "react-router";
import { Icon } from "./Icon";
import { buildSets } from "../utils/practiceSets";
type CountKey =
  | "practice"
  | "practiceTypes"
  | "practiceSections"
  | "practiceMocks"
  | "flts"
  | "students"
  | "trainers"
  | "tests"
  | "questions"
  | "unread";
// `short` is the visible text inside narrow groups; `label` stays the accessible name.
// `hint` is a short description shown beside the item on hover or focus.
type NavEntry = { icon: string; label: string; to: string; count?: CountKey; short?: string; hint?: string };
type NavGroup = { icon: string; label: string; items: (NavEntry | NavGroup)[]; count?: CountKey };
type NavNode = NavEntry | NavGroup;
const link = (icon: string, label: string, to: string, count?: CountKey): NavEntry => ({ icon, label, to, count });
const studentNavigation: NavNode[] = [
  link("dashboard", "Dashboard", "/student/dashboard"),
  {
    icon: "test",
    label: "Tests",
    items: [
      {
        icon: "book",
        label: "Learning Arena",
        count: "practiceTypes",
        items: [
          {
            ...link("list-check", "Question Specific", "/student/practice/question-specific", "practiceTypes"),
            hint: "Practise one question type at a time.",
          },
          {
            ...link("dashboard", "Sectional", "/student/practice/sectional", "practiceSections"),
            hint: "Practise a whole section or passage.",
          },
        ],
      },
      {
        ...link("clock", "Practice Module Test", "/student/practice-mocks", "practiceMocks"),
        hint: "Practice Mock Tests under real exam conditions.",
      },
    ],
  },
  // Full Length Tests are kept apart from all practice material, so they have their own tab.
  {
    ...link("trophy", "Full Length Tests", "/student/mock-tests", "flts"),
    hint: "Full IELTS tests your institute opens.",
  },
  link("bell", "Notifications", "/student/notifications", "unread"),
  link("history", "Test History", "/student/history"),
  link("flag", "Issue Reports", "/student/issues"),
  link("file-plus", "Raise a Request", "/student/requests"),
  link("trophy", "Leaderboard", "/student/leaderboard"),
  link("user", "Profile", "/student/profile"),
];
const adminNavigation: NavNode[] = [
  link("dashboard", "Admin Overview", "/admin/dashboard"),
  {
    icon: "users",
    label: "People",
    items: [
      link("users", "Students", "/admin/students", "students"),
      { ...link("users", "Trainers & assignments", "/admin/trainers", "trainers"), short: "Trainers" },
    ],
  },
  {
    icon: "book",
    label: "Content",
    items: [
      link("test", "Test Management", "/admin/mock-tests", "tests"),
      link("book", "Question Bank", "/admin/questions", "questions"),
      link("play", "Media library", "/admin/media"),
      link("plus", "Content import", "/admin/imports"),
    ],
  },
  {
    icon: "chart",
    label: "Results",
    items: [link("check", "Results", "/admin/results"), link("chart", "Reports", "/admin/reports")],
  },
  {
    icon: "flag",
    label: "Support",
    items: [link("flag", "Issue reports", "/admin/issues"), link("file-plus", "Student requests", "/admin/requests")],
  },
  link("bell", "Notifications", "/admin/notifications", "unread"),
  {
    icon: "settings",
    label: "System",
    items: [
      link("history", "Operations", "/admin/operations"),
      link("shield", "Audit log", "/admin/audit"),
      link("settings", "Settings", "/admin/settings"),
    ],
  },
];
const trainerNavigation: NavNode[] = [
  link("dashboard", "Trainer Overview", "/trainer/dashboard"),
  link("users", "Students", "/trainer/students"),
  link("test", "Evaluation Queue", "/trainer/evaluations"),
  link("chart", "Reports", "/trainer/reports"),
  link("bell", "Notifications", "/trainer/notifications", "unread"),
  link("user", "Profile", "/trainer/profile"),
];
// Counts come from already-loaded portal data; lists capped by pagination show "+".
const practiceOf = (data: PreviewValue) =>
  data.questions.filter(q => q.skill !== "Speaking" && (q.course === "BOTH" || q.course === data.course));
function navCounts(data: PreviewValue): Partial<Record<CountKey, string>> {
  const capped = (n: number) => `${n}${data.hasMore && n >= 500 ? "+" : ""}`;
  const offered = (kind: "FLT" | "PRACTICE_MOCK") =>
    data.tests.filter(t => t.kind === kind && t.available && t.course === data.course).length;
  const unread = data.notifications.filter(n => !n.read).length;
  return {
    practice: capped(data.questions.length),
    practiceTypes: String(buildSets(practiceOf(data), "type").length),
    practiceSections: String(buildSets(practiceOf(data), "section").length),
    practiceMocks: String(offered("PRACTICE_MOCK")),
    flts: String(offered("FLT")),
    students: String(data.statistics?.students ?? capped(data.students.length)),
    trainers: String(data.statistics?.trainers ?? capped(data.trainers.length)),
    tests: String(data.tests.length),
    questions: String(data.statistics?.questions ?? capped(data.questions.length)),
    ...(unread ? { unread: String(unread) } : {}),
  };
}
function NavItem({
  entry,
  count,
  collapsed,
  close,
}: {
  entry: NavEntry;
  count?: string;
  collapsed: boolean;
  close?: () => void;
}) {
  return (
    <NavLink
      to={entry.to}
      onClick={close}
      aria-label={entry.label}
      title={collapsed || entry.short ? entry.label : undefined}
      onPointerEnter={e =>
        e.currentTarget.style.setProperty("--tooltip-top", `${e.currentTarget.getBoundingClientRect().top}px`)
      }
      onFocus={e =>
        e.currentTarget.style.setProperty("--tooltip-top", `${e.currentTarget.getBoundingClientRect().top}px`)
      }
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
    >
      <Icon name={entry.icon} />
      <span className="sidebar-label">{collapsed ? entry.label : (entry.short ?? entry.label)}</span>
      {/* The count is supplementary; the link's accessible name stays the page name. */}
      {count && (
        <span className="nav-count sidebar-label" aria-hidden="true">
          ({count})
        </span>
      )}
      {collapsed && (
        <span className="nav-tooltip" role="tooltip">
          {entry.label}
        </span>
      )}
      {!collapsed && entry.hint && (
        <span className="nav-hint" role="tooltip">
          {entry.hint}
        </span>
      )}
    </NavLink>
  );
}
const leaves = (items: (NavEntry | NavGroup)[]): NavEntry[] =>
  items.flatMap(i => ("items" in i ? leaves(i.items) : [i]));
function NavSection({
  group,
  counts,
  close,
  nested = false,
}: {
  group: NavGroup;
  counts: Partial<Record<CountKey, string>>;
  close?: () => void;
  nested?: boolean;
}) {
  const { pathname } = useLocation();
  const containsActive = leaves(group.items).some(item => pathname.startsWith(item.to));
  // Groups start closed and open on click; a closed group still marks the active page.
  const [open, setOpen] = useState(false);
  // The sidebar renders in both the desktop rail and the mobile drawer, so IDs must be unique per instance.
  const id = useId();
  const count = group.count && counts[group.count];
  return (
    <div className={`nav-group ${nested ? "nav-subgroup" : ""}`}>
      <button
        type="button"
        className={`nav-item nav-group-toggle ${containsActive && !open ? "has-active" : ""}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Icon name={group.icon} />
        <span className="sidebar-label">{group.label}</span>
        {count && (
          <span className="nav-count sidebar-label" aria-hidden="true">
            ({count})
          </span>
        )}
        <span className="nav-group-chevron">
          <Icon name="chevron" size={16} />
        </span>
      </button>
      {open && (
        <div className="nav-group-items" id={id}>
          {group.items.map(item =>
            "items" in item ? (
              <NavSection key={item.label} group={item} counts={counts} close={close} nested />
            ) : (
              <NavItem
                key={item.to}
                entry={item}
                count={item.count && counts[item.count]}
                collapsed={false}
                close={close}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
export function Sidebar({
  admin = false,
  trainer = false,
  collapsed = false,
  close,
}: {
  admin?: boolean;
  trainer?: boolean;
  collapsed?: boolean;
  close?: () => void;
}) {
  const portal = usePreview();
  const { mode, logout } = portal;
  const counts = navCounts(portal);
  return (
    <div className={`sidebar-content ${collapsed ? "compact" : ""}`}>
      <Link
        to={admin ? "/admin/dashboard" : trainer ? "/trainer/dashboard" : "/student/dashboard"}
        className="brand"
        aria-label="Kanan IELTS home"
        onClick={close}
      >
        <span className="brand-initial">K</span>
        <span className="sidebar-label">
          <strong>KANAN</strong>
          <small>{admin ? "ADMIN PORTAL" : trainer ? "TRAINER PORTAL" : "IELTS PREP PORTAL"}</small>
        </span>
      </Link>
      <p className="nav-caption sidebar-label">
        {admin ? "CURRICULUM & MANAGEMENT" : trainer ? "EVALUATION & STUDENTS" : "YOUR LEARNING SPACE"}
      </p>
      <nav aria-label={admin ? "Admin navigation" : trainer ? "Trainer navigation" : "Student navigation"}>
        {/* Collapsed rails flatten groups so every page icon stays visible. */}
        {(admin ? adminNavigation : trainer ? trainerNavigation : studentNavigation).flatMap(node =>
          "items" in node
            ? collapsed
              ? leaves(node.items).map(item => <NavItem key={item.to} entry={item} collapsed close={close} />)
              : [<NavSection key={node.label} group={node} counts={counts} close={close} />]
            : [
                <NavItem
                  key={node.to}
                  entry={node}
                  count={node.count && counts[node.count]}
                  collapsed={collapsed}
                  close={close}
                />,
              ],
        )}
      </nav>
      <div className="sidebar-bottom">
        {mode === "demo" && !admin && !trainer && (
          <div className="target-card sidebar-label">
            <Icon name="trophy" />
            <div>
              <small>TARGET BAND</small>
              <strong>Band 8.0</strong>
            </div>
          </div>
        )}
        <Link
          to={admin ? "/admin/login" : trainer ? "/trainer/login" : "/student/login"}
          className="nav-item"
          onClick={
            mode === "live"
              ? () => {
                  void logout();
                  close?.();
                }
              : close
          }
          aria-label={mode === "live" ? "Sign out" : "Back to login preview"}
        >
          <Icon name="logout" />
          <span className="sidebar-label">{mode === "live" ? "Sign out" : "Login preview"}</span>
          {collapsed && <span className="nav-tooltip">{mode === "live" ? "Sign out" : "Login preview"}</span>}
        </Link>
      </div>
    </div>
  );
}
