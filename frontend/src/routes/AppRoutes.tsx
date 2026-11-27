import { lazyPage } from "./lazyPage";
import { Protected } from "../app/Protected";
import { PortalShell } from "../layouts/PortalShell";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { StudentLayout } from "../layouts/StudentLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { ExamLayout } from "../layouts/ExamLayout";
import { Login, NotFound, StatePreview } from "../pages/utility/Utility";
import { usePreview } from "../app/PreviewContext";
import { skills } from "../mocks/practice";
// Pages load on demand; sign-in, layouts and route guards stay in the first bundle.
const PracticeLibrary = lazyPage(() => import("../pages/student/PracticeLibrary"), "PracticeLibrary");
const AdminRequests = lazyPage(() => import("../pages/shared/Requests"), "AdminRequests");
const StudentRequests = lazyPage(() => import("../pages/shared/Requests"), "StudentRequests");
const AdminIssues = lazyPage(() => import("../pages/shared/Issues"), "AdminIssues");
const StudentIssues = lazyPage(() => import("../pages/shared/Issues"), "StudentIssues");
const Media = lazyPage(() => import("../pages/admin/Media"), "Media");
const Reports = lazyPage(() => import("../pages/admin/Reports"), "Reports");
const Operations = lazyPage(() => import("../pages/admin/Operations"), "Operations");
const ContentImports = lazyPage(() => import("../pages/admin/Imports"), "ContentImports");
const TrainerDashboard = lazyPage(() => import("../pages/trainer/Trainer"), "TrainerDashboard");
const TrainerStudents = lazyPage(() => import("../pages/trainer/Trainer"), "TrainerStudents");
const TrainerStudentProfile = lazyPage(() => import("../pages/trainer/Trainer"), "TrainerStudentProfile");
const EvaluationQueue = lazyPage(() => import("../pages/trainer/Trainer"), "EvaluationQueue");
const TrainerProfile = lazyPage(() => import("../pages/trainer/Trainer"), "TrainerProfile");
const Trainers = lazyPage(() => import("../pages/admin/Trainers"), "Trainers");
const Evaluation = lazyPage(() => import("../pages/shared/Evaluation"), "Evaluation");
const Notifications = lazyPage(() => import("../pages/shared/Notifications"), "Notifications");
const AuditLog = lazyPage(() => import("../pages/shared/Notifications"), "AuditLog");
const Dashboard = lazyPage(() => import("../pages/student/Dashboard"), "Dashboard");
const PracticeHub = lazyPage(() => import("../pages/student/Dashboard"), "PracticeHub");
const Practice = lazyPage(() => import("../pages/student/Practice"), "Practice");
const MockInstructions = lazyPage(() => import("../pages/student/MockTests"), "MockInstructions");
const MockTests = lazyPage(() => import("../pages/student/MockTests"), "MockTests");
const Results = lazyPage(() => import("../pages/student/Results"), "Results");
const TestHistory = lazyPage(() => import("../pages/student/Results"), "TestHistory");
const ExpiredAccess = lazyPage(() => import("../pages/student/Profile"), "ExpiredAccess");
const Leaderboard = lazyPage(() => import("../pages/student/Profile"), "Leaderboard");
const Profile = lazyPage(() => import("../pages/student/Profile"), "Profile");
const Exam = lazyPage(() => import("../pages/student/Exam"), "Exam");
const AdminDashboard = lazyPage(() => import("../pages/admin/Dashboard"), "AdminDashboard");
const AdminResults = lazyPage(() => import("../pages/admin/Dashboard"), "AdminResults");
const StudentDetails = lazyPage(() => import("../pages/admin/Students"), "StudentDetails");
const Students = lazyPage(() => import("../pages/admin/Students"), "Students");
const QuestionBank = lazyPage(() => import("../pages/admin/Questions"), "QuestionBank");
const QuestionEditor = lazyPage(() => import("../pages/admin/Questions"), "QuestionEditor");
const AdminMocks = lazyPage(() => import("../pages/admin/Mocks"), "AdminMocks");
const MockBuilder = lazyPage(() => import("../pages/admin/MockBuilder"), "MockBuilder");
const Settings = lazyPage(() => import("../pages/admin/Settings"), "Settings");
export function AppRoutes() {
  const { course } = usePreview();
  const location = useLocation();
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/student/login" replace />} />
      <Route path="/student/login" element={<Login />} />
      <Route path="/admin/login" element={<Login admin />} />
      <Route path="/trainer/login" element={<Login trainer />} />
      <Route
        element={
          <Protected role="trainer">
            <PortalShell trainer />
          </Protected>
        }
      >
        <Route path="/trainer/dashboard" element={<TrainerDashboard />} />
        <Route path="/trainer/students" element={<TrainerStudents />} />
        <Route path="/trainer/students/:studentId" element={<TrainerStudentProfile />} />
        <Route path="/trainer/evaluations" element={<EvaluationQueue />} />
        <Route path="/trainer/evaluations/:attemptId" element={<Evaluation key={location.pathname} />} />
        <Route path="/trainer/reports" element={<Reports trainer />} />
        <Route path="/trainer/profile" element={<TrainerProfile />} />
        <Route path="/trainer/notifications" element={<Notifications role="trainer" />} />
      </Route>
      <Route element={<StudentLayout />}>
        <Route path="/student/dashboard" element={<Dashboard />} />
        <Route path="/student/practice" element={<PracticeHub />} />
        <Route path="/student/practice/question-specific" element={<PracticeLibrary key="type" mode="type" />} />
        <Route path="/student/practice/sectional" element={<PracticeLibrary key="section" mode="section" />} />
        {skills.map(skill => (
          <Route
            key={skill}
            path={`/student/practice/${skill.toLowerCase()}/:practiceId`}
            element={<Practice key={`${location.pathname}-${course}`} skill={skill} />}
          />
        ))}
        <Route path="/student/mock-tests" element={<MockTests key="flt" />} />
        <Route path="/student/practice-mocks" element={<MockTests key="practice-mocks" practice />} />
        <Route path="/student/notifications" element={<Notifications role="student" />} />
        <Route
          path="/student/mock-tests/:courseId/:testId/instructions"
          element={<MockInstructions key={`${location.pathname}-${course}`} />}
        />
        <Route path="/student/results/:attemptId" element={<Results />} />
        <Route path="/student/results/:attemptId/details" element={<Results detailed />} />
        <Route path="/student/history" element={<TestHistory />} />
        <Route path="/student/issues" element={<StudentIssues />} />
        <Route path="/student/requests" element={<StudentRequests />} />
        <Route path="/student/leaderboard" element={<Leaderboard />} />
        <Route path="/student/profile" element={<Profile />} />
        <Route path="/student/access-expired" element={<ExpiredAccess />} />
      </Route>
      <Route
        element={
          <Protected role="student">
            <ExamLayout />
          </Protected>
        }
      >
        <Route path="/student/attempts/:attemptId" element={<Exam key={location.pathname} />} />
      </Route>
      <Route element={<AdminLayout />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<Students />} />
        <Route path="/admin/trainers" element={<Trainers />} />
        <Route path="/admin/media" element={<Media />} />
        <Route path="/admin/imports" element={<ContentImports />} />
        <Route path="/admin/results/:attemptId" element={<Evaluation key={location.pathname} admin />} />
        <Route path="/admin/notifications" element={<Notifications role="admin" />} />
        <Route path="/admin/audit" element={<AuditLog />} />
        <Route path="/admin/students/:studentId" element={<StudentDetails key={location.pathname} />} />
        <Route path="/admin/questions" element={<QuestionBank />} />
        <Route path="/admin/questions/new" element={<QuestionEditor />} />
        <Route path="/admin/questions/:questionId/edit" element={<QuestionEditor />} />
        <Route path="/admin/mock-tests" element={<AdminMocks />} />
        <Route path="/admin/mock-tests/:courseId/:testId/builder" element={<MockBuilder key={location.pathname} />} />
        <Route path="/admin/results" element={<AdminResults />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/issues" element={<AdminIssues />} />
        <Route path="/admin/requests" element={<AdminRequests />} />
        <Route path="/admin/operations" element={<Operations />} />
        <Route path="/admin/settings" element={<Settings />} />
      </Route>
      <Route path="/preview/states" element={<StatePreview />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
