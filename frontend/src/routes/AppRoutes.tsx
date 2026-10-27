import {Media} from "../pages/admin/Media";
import {Reports} from "../pages/admin/Reports";
import {Operations} from "../pages/admin/Operations";
import { ContentImports } from "../pages/admin/Imports";
import { Protected } from "../app/Protected";
import { PortalShell } from "../layouts/PortalShell";
import { TrainerDashboard, TrainerStudents, TrainerStudentProfile, EvaluationQueue, TrainerProfile } from "../pages/trainer/Trainer";
import { Trainers } from "../pages/admin/Trainers";
import { Evaluation } from "../pages/shared/Evaluation";
import { Notifications, AuditLog } from "../pages/shared/Notifications";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { StudentLayout } from "../layouts/StudentLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { ExamLayout } from "../layouts/ExamLayout";
import { Dashboard, PracticeHub } from "../pages/student/Dashboard";
import { Practice } from "../pages/student/Practice";
import { MockInstructions, MockTests } from "../pages/student/MockTests";
import { Results, TestHistory } from "../pages/student/Results";
import { ExpiredAccess, Leaderboard, Profile } from "../pages/student/Profile";
import { Exam } from "../pages/student/Exam";
import { Login, NotFound, StatePreview } from "../pages/utility/Utility";
import { AdminDashboard, AdminResults } from "../pages/admin/Dashboard";
import { StudentDetails, Students } from "../pages/admin/Students";
import { QuestionBank, QuestionEditor } from "../pages/admin/Questions";
import { AdminMocks, MockBuilder } from "../pages/admin/Mocks";
import { Settings } from "../pages/admin/Settings";
import { usePreview } from "../app/PreviewContext";
import { skills } from "../mocks/practice";
export function AppRoutes() {
  const { course } = usePreview();
  const location = useLocation();
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/student/login" replace />} />
      <Route path="/student/login" element={<Login />} />
      <Route path="/admin/login" element={<Login admin />} />
      <Route path="/trainer/login" element={<Login trainer />} />
      <Route element={<Protected role="trainer"><PortalShell trainer /></Protected>}>
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
        {skills.map((skill) => (
          <Route
            key={skill}
            path={`/student/practice/${skill.toLowerCase()}/:practiceId`}
            element={
              <Practice key={`${location.pathname}-${course}`} skill={skill} />
            }
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
        <Route
          path="/student/results/:attemptId/details"
          element={<Results detailed />}
        />
        <Route path="/student/history" element={<TestHistory />} />
        <Route path="/student/leaderboard" element={<Leaderboard />} />
        <Route path="/student/profile" element={<Profile />} />
        <Route path="/student/access-expired" element={<ExpiredAccess />} />
      </Route>
      <Route element={<Protected role="student"><ExamLayout /></Protected>}>
        <Route
          path="/student/attempts/:attemptId"
          element={<Exam key={location.pathname} />}
        />
      </Route>
      <Route element={<AdminLayout />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<Students />} />
        <Route path="/admin/trainers" element={<Trainers />} />
        <Route path="/admin/media" element={<Media/>}/>
        <Route path="/admin/imports" element={<ContentImports />} />
        <Route path="/admin/results/:attemptId" element={<Evaluation key={location.pathname} admin />} />
        <Route path="/admin/notifications" element={<Notifications role="admin" />} />
        <Route path="/admin/audit" element={<AuditLog />} />
        <Route
          path="/admin/students/:studentId"
          element={<StudentDetails key={location.pathname} />}
        />
        <Route path="/admin/questions" element={<QuestionBank />} />
        <Route path="/admin/questions/new" element={<QuestionEditor />} />
        <Route
          path="/admin/questions/:questionId/edit"
          element={<QuestionEditor />}
        />
        <Route path="/admin/mock-tests" element={<AdminMocks />} />
        <Route
          path="/admin/mock-tests/:courseId/:testId/builder"
          element={<MockBuilder key={location.pathname} />}
        />
        <Route path="/admin/results" element={<AdminResults />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/operations" element={<Operations />} />
        <Route path="/admin/settings" element={<Settings />} />
      </Route>
      <Route path="/preview/states" element={<StatePreview />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
