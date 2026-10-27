import { useEffect, useState } from "react";
import { usePreview } from "../../app/PreviewContext";
import {
  Badge,
  Card,
  ContentContainer,
  EmptyState,
  LinkButton,
  LoadingState,
  PageHeader,
  SectionTitle,
  Tabs,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { courseName, dateLabel } from "../../utils/format";
import { api } from "../../services/api";
import { leaderboardService } from "../../services/mockAdapter";
import type { LeaderboardEntry } from "../../types/domain";
export function Profile() {
  const { course, students, results,mode } = usePreview();
  const student = students.find((s) => s.course === course)!;
  return (
    <ContentContainer>
      <PageHeader
        title="Student profile & course access"
        description="Your account information and enrolled IELTS course."
      />
      <div className="two-column">
        <Card>
          <div className="row mb-6">
            <span className="avatar">
              {student.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
            <div>
              <h2>{student.name}</h2>
              <p className="muted text-xs">{student.id}</p>
            </div>
          </div>
          <SectionTitle
            title="Student details"
            detail={<Badge tone="gray">Read-only</Badge>}
          />
          {[
            ["Assigned course", courseName(student.course)],
            ["Start date", dateLabel(student.startDate)],
            ["Access expiry", dateLabel(student.expiryDate)],
            ["Account status", student.enabled ? "Active" : "Disabled"],
            [
              "Tests completed",
              String(results.filter((r) => r.studentId === student.id).length),
            ],
          ].map(([key, value]) => (
            <div className="list-row" key={key}>
              <span className="muted text-xs">{key}</span>
              <strong className="text-sm">{value}</strong>
            </div>
          ))}
          <p className="muted text-xs mt-6">
            Your Student ID, password and course assignment are managed by the
            Kanan office.
          </p>
        </Card>
        <div className="stack">
          <div className="course-card">
            <Badge tone="green">Currently enrolled</Badge>
            <h2 className="mt-4">{courseName(course)}</h2>
            <p className="muted text-sm my-4">
              Practise Listening, Reading and Writing. Take Speaking offline with your trainer.
            </p>
            <LinkButton to="/student/dashboard">Open dashboard</LinkButton>
          </div>
          <div className="course-card locked">
            <div className="row">
              <Icon name="lock" />
              <h2>
                {courseName(course === "GENERAL" ? "ACADEMIC" : "GENERAL")}
              </h2>
            </div>
            <p className="text-sm mt-4">
              This course is not assigned to your account. Contact the Kanan
              office to discuss a course change.
            </p>
            <div className="mt-5">
              <Badge tone="gray">Course locked</Badge>
            </div>
          </div>
          {mode === "demo" && <LinkButton secondary to="/student/access-expired">Preview expired-access state</LinkButton>}
        </div>
      </div>
    </ContentContainer>
  );
}
export function ExpiredAccess() {
  const {currentUser,mode,settings}=usePreview();
  return (
    <ContentContainer>
      <Card>
        <EmptyState
          title="Your portal access has expired"
          description="Contact the Kanan office to discuss renewing your access."
          action={
            <LinkButton to="/student/login">{mode === "demo" ? "Back to login preview" : "Back to login"}</LinkButton>
          }
        />
      </Card>
      {mode === "live" && <Card><p>{settings.supportPhone}</p><p>{settings.supportEmail}</p><p>{settings.supportAddress}</p></Card>}
      {mode === "demo" ? <p className="muted text-xs text-center">Frontend state preview.</p> : <p className="muted text-sm">{currentUser?.name} / {currentUser?.course} / Access expires {currentUser?.expiryDate}</p>}
    </ContentContainer>
  );
}
export function Leaderboard() {
  const { course, settings, mode } = usePreview();
  const [period, setPeriod] = useState("Weekly");
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loadedKey,setLoadedKey]=useState(""),[error,setError]=useState("");const key=`${course}/${period}`;const loading=loadedKey!==key;
  useEffect(() => {
    let active = true;
    if(!settings.leaderboard)return;
    const request = mode === "live" ? api<LeaderboardEntry[]>(`/leaderboard?period=${period}`) : leaderboardService.list(course, period);
    request.then((data) => {
      if (active) {setRows(data);setError("");}
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoadedKey(key);});
    return () => {
      active = false;
    };
  }, [course, period, mode,settings.leaderboard,key]);
  if (!settings.leaderboard) return <ContentContainer><Card><EmptyState title="Leaderboard is disabled" description="Rankings are currently unavailable." /></Card></ContentContainer>;
  return (
    <ContentContainer>
      <PageHeader
        title="Student leaderboard"
        description="A little inspiration from your learning community."
        actions={<Badge>{courseName(course)}</Badge>}
      />
      <Tabs
        options={["Weekly", "Monthly", "Overall"]}
        value={period}
        onChange={setPeriod}
        label="Ranking period"
      />
      <p className="muted text-xs">
        Illustrative {period.toLowerCase()} rankings · Display names only
      </p>
      {error&&<p role="alert" className="error-text">{error}</p>}
      {loading ? <LoadingState/> : !rows.length ? (
        <EmptyState title="No eligible scores yet"/>
      ) : (
        <>
          <div className="podium">
            {rows.slice(0, 3).map((r, i) => (
              <Card key={r.name}>
                <span className="icon-tile">
                  <Icon name="trophy" size={28} />
                </span>
                <Badge>#{i + 1}</Badge>
                <h3>{r.name}</h3>
                <span className="score-number">{r.band.toFixed(1)}</span>
                <small className="muted">{mode === "demo" ? "Sample band" : "Average band"}</small>
              </Card>
            ))}
          </div>
          <Card>
            <SectionTitle title={`${period} rankings`} />
            {rows.map((r, i) => (
              <div className="list-row" key={r.name}>
                <div className="row">
                  <Badge tone="gray">#{i + 1}</Badge>
                  <strong>{r.name}</strong>
                </div>
                <div className="actions">
                  <span className="muted text-xs">{r.completed} mocks</span>
                  <Badge>Band {r.band.toFixed(1)}</Badge>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </ContentContainer>
  );
}
