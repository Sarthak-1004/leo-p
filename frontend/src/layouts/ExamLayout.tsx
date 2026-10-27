import { usePreview } from "../app/PreviewContext";
import { Link, Outlet } from "react-router";
import { Badge } from "../components/ui";
import { Icon } from "../components/Icon";
export function ExamLayout() {
  const {mode}=usePreview();
  return (
    <div className="exam-layout">
      <a href="#exam-content" className="skip-link">
        Skip to exam
      </a>
      <header className="exam-header">
        <Link to="/student/mock-tests" className="row">
          <Icon name="test" />
          <strong>KANAN IELTS</strong>
        </Link>
        <Badge>{mode === "live" ? "Assessment" : "Assessment preview"}</Badge>
        <Link to="/student/mock-tests">{mode === "live" ? "Exit test" : "Exit preview"}</Link>
      </header>
      {mode === "demo" && <div className="preview-bar">
        Sample assessment · Answers stay in preview memory until reload · No
        remote saving or scoring
      </div>
      }
      <main id="exam-content">
        <Outlet />
      </main>
    </div>
  );
}
