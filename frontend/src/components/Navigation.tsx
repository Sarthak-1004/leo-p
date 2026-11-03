import { useId, useState } from "react";
import { usePreview } from "../app/PreviewContext";
import type { PreviewValue } from "../app/context";
import { NavLink, Link, useLocation } from "react-router";
import { Icon } from "./Icon";
type CountKey = "practice" | "practiceMocks" | "flts" | "students" | "trainers" | "tests" | "questions" | "unread";
// `short` is the visible text inside narrow groups; `label` stays the accessible name.
type NavEntry = { icon: string; label: string; to: string; count?: CountKey; short?: string };
type NavGroup = { icon: string; label: string; items: NavEntry[] };
type NavNode = NavEntry | NavGroup;
const link = (icon: string, label: string, to: string, count?: CountKey): NavEntry => ({ icon, label, to, count });
const studentNavigation: NavNode[] = [
  link("dashboard", "Dashboard", "/student/dashboard"),
  { icon: "test", label: "Tests", items: [
    link("book", "Practice", "/student/practice", "practice"),
    { ...link("clock", "Practice Mock Tests", "/student/practice-mocks", "practiceMocks"), short: "Practice Mocks" },
    link("test", "Full Length Tests", "/student/mock-tests", "flts"),
  ] },
  link("bell", "Notifications", "/student/notifications", "unread"),
  link("history", "Test History", "/student/history"),
  link("trophy", "Leaderboard", "/student/leaderboard"),
  link("user", "Profile", "/student/profile"),
];
const adminNavigation: NavNode[] = [
  link("dashboard", "Admin Overview", "/admin/dashboard"),
  { icon: "users", label: "People", items: [
    link("users", "Students", "/admin/students", "students"),
    { ...link("users", "Trainers & assignments", "/admin/trainers", "trainers"), short: "Trainers" },
  ] },
  { icon: "book", label: "Content", items: [
    link("test", "Test Management", "/admin/mock-tests", "tests"),
    link("book", "Question Bank", "/admin/questions", "questions"),
    link("play", "Media library", "/admin/media"),
    link("plus", "Content import", "/admin/imports"),
  ] },
  { icon: "chart", label: "Results", items: [
    link("check", "Results", "/admin/results"),
    link("chart", "Reports", "/admin/reports"),
  ] },
  link("bell", "Notifications", "/admin/notifications", "unread"),
  { icon: "settings", label: "System", items: [
    link("history", "Operations", "/admin/operations"),
    link("shield", "Audit log", "/admin/audit"),
    link("settings", "Settings", "/admin/settings"),
  ] },
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
function navCounts(data: PreviewValue): Partial<Record<CountKey, string>> {
  const capped = (n: number) => `${n}${data.hasMore && n >= 500 ? "+" : ""}`;
  const offered = (kind: "FLT" | "PRACTICE_MOCK") => data.tests.filter(t => t.kind === kind && t.available && t.course === data.course).length;
  const unread = data.notifications.filter(n => !n.read).length;
  return {
    practice: capped(data.questions.length), practiceMocks: String(offered("PRACTICE_MOCK")), flts: String(offered("FLT")),
    students: String(data.statistics?.students ?? capped(data.students.length)), trainers: String(data.statistics?.trainers ?? capped(data.trainers.length)),
    tests: String(data.tests.length), questions: capped(data.questions.length), ...(unread ? { unread: String(unread) } : {}),
  };
}
function NavItem({ entry, count, collapsed, close }: { entry: NavEntry; count?: string; collapsed: boolean; close?: () => void }) {
  return (
    <NavLink
      to={entry.to}
      onClick={close}
      aria-label={entry.label}
      title={collapsed || entry.short ? entry.label : undefined}
      onPointerEnter={e => e.currentTarget.style.setProperty("--tooltip-top", `${e.currentTarget.getBoundingClientRect().top}px`)}
      onFocus={e => e.currentTarget.style.setProperty("--tooltip-top", `${e.currentTarget.getBoundingClientRect().top}px`)}
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
    >
      <Icon name={entry.icon} />
      <span className="sidebar-label">{collapsed ? entry.label : entry.short ?? entry.label}</span>
      {/* The count is supplementary; the link's accessible name stays the page name. */}
      {count && <span className="nav-count sidebar-label" aria-hidden="true">({count})</span>}
      {collapsed && (
        <span className="nav-tooltip" role="tooltip">
          {entry.label}
        </span>
      )}
    </NavLink>
  );
}
function NavSection({ group, counts, close }: { group: NavGroup; counts: Partial<Record<CountKey, string>>; close?: () => void }) {
  const { pathname } = useLocation();
  const containsActive = group.items.some(item => pathname.startsWith(item.to));
  const [open, setOpen] = useState(true);
  // The sidebar renders in both the desktop rail and the mobile drawer, so IDs must be unique per instance.
  const id = useId();
  return (
    <div className="nav-group">
      <button type="button" className={`nav-item nav-group-toggle ${containsActive && !open ? "has-active" : ""}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Icon name={group.icon} />
        <span className="sidebar-label">{group.label}</span>
        <span className="nav-group-chevron"><Icon name="chevron" size={16} /></span>
      </button>
      {open && (
        <div className="nav-group-items" id={id}>
          {group.items.map(item => <NavItem key={item.to} entry={item} count={item.count && counts[item.count]} collapsed={false} close={close} />)}
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
  const portal=usePreview();const {mode,logout}=portal;
  const counts=navCounts(portal);
  return (
    <div
      className={`sidebar-content ${collapsed ? "compact" : ""}`}
    >
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
              ? node.items.map(item => <NavItem key={item.to} entry={item} collapsed close={close} />)
              : [<NavSection key={node.label} group={node} counts={counts} close={close} />]
            : [<NavItem key={node.to} entry={node} count={node.count && counts[node.count]} collapsed={collapsed} close={close} />],
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
          onClick={mode === "live" ? () => { void logout(); close?.(); } : close}
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
