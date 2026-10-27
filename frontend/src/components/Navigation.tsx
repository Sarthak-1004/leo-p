import { usePreview } from "../app/PreviewContext";
import { NavLink, Link } from "react-router";
import { Icon } from "./Icon";
const studentNavigation = [
  ["dashboard", "Dashboard", "/student/dashboard"],
  ["book", "Practice", "/student/practice"],
  ["test", "Practice Mock Tests", "/student/practice-mocks"],
  ["test", "Full Length Tests", "/student/mock-tests"],
  ["bell", "Notifications", "/student/notifications"],
  ["history", "Test History", "/student/history"],
  ["trophy", "Leaderboard", "/student/leaderboard"],
  ["user", "Profile", "/student/profile"],
];
const adminNavigation = [
  ["dashboard", "Admin Overview", "/admin/dashboard"],
  ["users", "Students", "/admin/students"],
  ["users", "Trainers & assignments", "/admin/trainers"],
  ["test", "Test Management", "/admin/mock-tests"],
  ["book", "Question Bank", "/admin/questions"],
  ["book", "Media library", "/admin/media"],
  ["book", "Content import", "/admin/imports"],
  ["chart", "Results", "/admin/results"],
  ["chart", "Reports", "/admin/reports"],
  ["bell", "Notifications", "/admin/notifications"],
  ["history", "Operations", "/admin/operations"],
  ["history", "Audit log", "/admin/audit"],
  ["settings", "Settings", "/admin/settings"],
];
const trainerNavigation = [
  ["dashboard", "Trainer Overview", "/trainer/dashboard"],
  ["users", "Students", "/trainer/students"],
  ["test", "Evaluation Queue", "/trainer/evaluations"],
  ["chart", "Reports", "/trainer/reports"],
  ["bell", "Notifications", "/trainer/notifications"],
  ["user", "Profile", "/trainer/profile"],
];
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
  const {mode,logout}=usePreview();
  return (
    <div
      className={`sidebar-content ${admin ? "admin-sidebar" : ""} ${collapsed ? "compact" : ""}`}
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
        {(admin ? adminNavigation : trainer ? trainerNavigation : studentNavigation).map(
          ([icon, label, to]) => (
            <NavLink
              key={to}
              to={to}
              onClick={close}
              aria-label={label}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon name={icon} />
              <span className="sidebar-label">{label}</span>
              {collapsed && (
                <span className="nav-tooltip" role="tooltip">
                  {label}
                </span>
              )}
            </NavLink>
          ),
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
