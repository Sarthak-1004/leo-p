import { activeStudent } from "../utils/policy";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Sidebar } from "../components/Navigation";
import { Icon } from "../components/Icon";
import { Badge, ErrorState, LoadingState, Notice } from "../components/ui";
import { usePreview } from "../app/PreviewContext";
import { courseName } from "../utils/format";
export function PortalShell({ admin = false, trainer = false }: { admin?: boolean; trainer?: boolean }) {
  const [collapsed, setCollapsed] = useState(
    () =>
      window.matchMedia("(min-width: 768px) and (max-width: 1100px)").matches,
  );
  const [drawer, setDrawer] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { course, setCourse, status, retry, students, trainers, trainerId, setTrainerId, notifications, mode, currentUser, pending, error, clearError, hasMore, loadMore } = usePreview();
  const location = useLocation();
  const student = students.find((s) => s.course === course);
  const currentTrainer = trainers.find(t => t.id === trainerId);
  const role = admin ? "admin" : trainer ? "trainer" : "student";
  const unread = notifications.filter(n => n.role === role && !n.read && (!n.recipientId || n.recipientId === (trainer ? trainerId : student?.id))).length;
  useEffect(() => {
    if (drawer) dialog.current?.showModal();
    else dialog.current?.close();
  }, [drawer]);
  useEffect(() => {
    document.getElementById("main-content")?.focus();
  }, [location.pathname]);
  function closeDrawer() {
    setDrawer(false);
    trigger.current?.focus();
  }
  return (
    <div className={`portal ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="desktop-sidebar">
        <Sidebar admin={admin} trainer={trainer} collapsed={collapsed} />
      </aside>
      <dialog
        ref={dialog}
        className="mobile-drawer"
        aria-label="Navigation menu"
        onCancel={(e) => {
          e.preventDefault();
          closeDrawer();
        }}
        onClick={(e) => {
          if (
            e.target === e.currentTarget &&
            e.clientX > e.currentTarget.getBoundingClientRect().right
          )
            closeDrawer();
        }}
      >
        <button
          className="drawer-close icon-button"
          aria-label="Close navigation"
          onClick={closeDrawer}
        >
          <Icon name="close" />
        </button>
        <Sidebar admin={admin} trainer={trainer} close={closeDrawer} />
      </dialog>
      <div className="portal-body">
        <header className="app-header">
          <div className="row">
            <button
              className="icon-button desktop-toggle"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              <Icon name="collapse" />
            </button>
            <button
              ref={trigger}
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="header-context">
              {admin ? "Administration" : trainer ? "Trainer workspace" : "Your learning journey"}
            </span>
          </div>
          <div className="header-user">
            <Link to={`/${role}/notifications`} aria-label={`Notifications (${unread} unread)`} className="icon-button notification-button"><Icon name="bell" />{unread > 0 && <small className="notification-count">{unread > 99 ? "99+" : unread}</small>}</Link>
            <Badge>{admin ? "KANAN ADMIN" : trainer ? "TRAINER" : courseName(course)}</Badge>
            <span className="avatar">
              {admin
                ? "KA"
                : trainer ? "TR" : student?.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("")}
            </span>
            <div className="user-name">
              <strong>{currentUser?.name ?? (admin ? "Kanan Admin" : trainer ? currentTrainer?.name : student?.name)}</strong>
              <small>{admin ? "Portal management" : trainer ? "Academic evaluation" : "IELTS student"}</small>
            </div>
          </div>
        </header>
        {mode === "demo" && <div className="preview-bar">
          <span>
            <strong>Frontend preview</strong>
            <span className="preview-detail">
              {" "}
              · Sample data · Changes reset on reload
            </span>
          </span>
          <div className="row">
            {!admin && !trainer && (
              <label className="preview-course">
                Preview course
                <select
                  aria-label="Preview course"
                  value={course}
                  onChange={(e) => setCourse(e.target.value as typeof course)}
                >
                  <option value="GENERAL">General</option>
                  <option value="ACADEMIC">Academic</option>
                </select>
              </label>
            )}
            {trainer && <label className="preview-course">Preview trainer<select aria-label="Preview trainer" value={trainerId} onChange={e => setTrainerId(e.target.value)}>{trainers.filter(t => t.enabled).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
            {!trainer && <Link to="/trainer/dashboard">Trainer preview</Link>}
            <Link to={admin ? "/student/dashboard" : "/admin/dashboard"}>
              {admin ? "Student preview" : "Admin preview"}{" "}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        }
        {pending && <p className="notice portal-message" role="status">Saving changes...</p>}
        {error && <div className="notice portal-message" role="alert"><span>{error}</span><button className="btn btn-ghost" onClick={clearError}>Dismiss</button></div>}
        <main id="main-content" tabIndex={-1}>
          {status === "loading" ? (
            <LoadingState />
          ) : status === "error" ? (
            <div className="content-container">
              <ErrorState retry={retry} />
            </div>
          ) : !admin && !trainer && student && !activeStudent(student) && location.pathname !== "/student/access-expired" ? (
            <div className="content-container"><Notice>{!student.enabled ? "Your account is disabled." : "Your portal access is outside its active period."} Contact the Kanan office for assistance.</Notice></div>
          ) : trainer && !currentTrainer?.enabled ? (
            <div className="content-container"><Notice>This trainer account is disabled.</Notice></div>
          ) : (
            <Outlet />
          )}
        </main>
        {mode === "live" && hasMore && <div className="content-container"><Notice>More records are available. Load the next page to include older records in searches.</Notice><button className="btn btn-secondary" disabled={pending} onClick={() => void loadMore?.()}>Load more records</button></div>}
        <footer className="app-footer">
          Kanan IELTS Practice Portal <span>Practice with purpose.</span>
        </footer>
      </div>
    </div>
  );
}
