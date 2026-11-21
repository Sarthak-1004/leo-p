import {SpeakingPractice} from "../../components/SpeakingPractice";
import {useCallback,useEffect,useRef,useState} from "react";
import {useParams} from "react-router";
import {usePreview} from "../../app/PreviewContext";
import {api} from "../../services/api";
import {ObjectivePractice,WritingEditor} from "../../components/Assessment";
import {Badge,Button,Card,ContentContainer,EmptyState,LinkButton,Modal,Notice,PageHeader} from "../../components/ui";
import {TestScreen} from "../../components/TestScreen";
import type {TestAttempt} from "../../types/domain";
const sections=["Listening","Reading","Writing","Speaking"] as const;
// The server sends each Reading passage once; put it back on the questions that point to it.
function withPassages<T extends Partial<TestAttempt>>(a:T):T{return a.passages&&a.questions?{...a,questions:a.questions.map(q=>q.passageRef===undefined?q:{...q,passage:a.passages![q.passageRef]??q.passage})}:a;}
export function LiveExam(){
  const {attemptId}=useParams();const {course,refresh,settings:platform,students}=usePreview();
  const [attempt,setAttempt]=useState<TestAttempt>();const [error,setError]=useState("");const [saved,setSaved]=useState("Loading saved answers...");
  const [connected,setConnected]=useState(navigator.onLine);const [confirm,setConfirm]=useState(false);const [confirmSection,setConfirmSection]=useState(false);const [busy,setBusy]=useState(false);const [seconds,setSeconds]=useState(0);
  const [waitingForSection,setWaitingForSection]=useState(false);
  const current=useRef<TestAttempt | undefined>(undefined);const sending=useRef(false),edit=useRef(0),resumed=useRef(false),confirmed=useRef({remaining:0,at:0});
  // One session key per page load: reloading the attempt from this page never races itself, while
  // opening it in another tab (a different key) takes the attempt over.
  const tabKey=useRef(crypto.randomUUID());
  // Furthest Listening audio position heard; sent with every save so a reload continues rather than replays.
  const audioPosition=useRef<{audioPart:number;audioMs:number}|undefined>(undefined);
  const pendingSignal=useRef<{body:Record<string,unknown>;revision:number;submit:boolean}|undefined>(undefined);
  const patch=useCallback((change:Partial<TestAttempt>)=>{const next=current.current&&{...current.current,...change};if(next){edit.current++;current.current=next;setAttempt(next);setSaved("Unsaved changes");}},[]);
  useEffect(()=>{let active=true;api<TestAttempt>(`/attempts/${attemptId}?session=${tabKey.current}`).then(withPassages).then(a=>{if(!active)return;current.current=a;setAttempt(a);setSeconds(a.sectionRemainingSeconds ?? a.remainingSeconds);confirmed.current={remaining:a.sectionRemainingSeconds ?? a.remainingSeconds,at:performance.now()};setSaved("Saved on server");}).catch(e=>setError(e.message));return()=>{active=false;};},[attemptId]);
  const send=useCallback(async function persist(submit=false,completeSection=false,targetSection?:number):Promise<void>{
    // A hidden tab keeps signalling: it is still connected exam time (reported as hidden for review).
    const a=current.current;if(!a||a.state==="Submitted"||(!submit&&!navigator.onLine))return;
    if(sending.current){if(submit||completeSection||targetSection!==undefined){setBusy(true);await new Promise(resolve=>setTimeout(resolve,50));return persist(submit,completeSection,targetSection);}return;}
    if((submit||completeSection||targetSection!==undefined)&&pendingSignal.current&&!pendingSignal.current.submit){setBusy(true);await persist(false);if(pendingSignal.current){setBusy(false);return;}return persist(submit,completeSection,targetSection);}
    const pending=pendingSignal.current??{body:{sessionKey:a.sessionKey,sequence:(a.sequence??0)+1,answers:a.answers,section:targetSection??a.section,question:targetSection!==undefined?0:a.question,theme:a.theme,fontSize:a.fontSize,resumed:resumed.current,completeSection,hidden:document.hidden,...(audioPosition.current?audioPosition.current:{})},revision:edit.current,submit};
    pendingSignal.current=pending;
    // Submitting a section closes it on the server, so inputs stay locked until that is acknowledged.
    const transitioning=pending.body.section!==a.section||!!pending.body.completeSection;
    if(transitioning)setWaitingForSection(true);
    sending.current=true;if(submit||completeSection||targetSection!==undefined||transitioning)setBusy(true);const revision=pending.revision;setSaved("Saving...");
    try{
      const response=await api<{attempt:TestAttempt;submitted:boolean}>(`/attempts/${a.id}/${pending.submit?"submit":"heartbeat"}`,{method:"POST",body:pending.body}),result={...response,attempt:withPassages(response.attempt)};
      pendingSignal.current=undefined;
      setWaitingForSection(false);
      if(pending.body.resumed)resumed.current=false;const latest=current.current!;
      // The server opens the next section when time runs out; always take its section and questions then.
      const next=revision===edit.current||result.submitted||pending.body.completeSection||transitioning||targetSection!==undefined||result.attempt.section!==latest.section?{...a,...result.attempt}:{...latest,sequence:result.attempt.sequence,remainingSeconds:result.attempt.remainingSeconds,interruptions:result.attempt.interruptions,remainingBySection:result.attempt.remainingBySection,submittedSections:result.attempt.submittedSections};
      current.current=next;setAttempt(next);confirmed.current={remaining:result.attempt.sectionRemainingSeconds ?? result.attempt.remainingSeconds,at:performance.now()};setSeconds(result.attempt.sectionRemainingSeconds ?? result.attempt.remainingSeconds);setSaved(revision===edit.current?"Saved on server":"Unsaved changes");setError("");setConnected(navigator.onLine);
      if(result.submitted)await refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"Answers could not be saved");setSaved("Not saved. Your current answers are still on this page.");}
    finally{sending.current=false;if(submit||completeSection||targetSection!==undefined||transitioning)setBusy(false);}
  },[refresh]);
  const sendRef=useRef(send);useEffect(()=>{sendRef.current=send;},[send]);
  useEffect(()=>{
    const change=()=>{const online=navigator.onLine;setConnected(online);if(!online){resumed.current=true;setSeconds(confirmed.current.remaining);}else void sendRef.current();};
    const timer=setInterval(()=>{if(navigator.onLine&&current.current?.state==="In progress")setSeconds(Math.max(0,confirmed.current.remaining-Math.floor((performance.now()-confirmed.current.at)/1000)));},500);
    let worker:Worker|undefined,heartbeat:ReturnType<typeof setInterval>|undefined;
    try{worker=new Worker(new URL("../../utils/heartbeatWorker.ts",import.meta.url),{type:"module"});worker.onmessage=()=>void sendRef.current();worker.postMessage(3000);}
    catch{heartbeat=setInterval(()=>void sendRef.current(),3000);}
    window.addEventListener("online",change);window.addEventListener("offline",change);document.addEventListener("visibilitychange",change);
    const unload=(event:BeforeUnloadEvent)=>{if(saved!=="Saved on server"&&current.current?.state==="In progress"){event.preventDefault();}};
    window.addEventListener("beforeunload",unload);
    return()=>{clearInterval(timer);clearInterval(heartbeat);worker?.terminate();window.removeEventListener("online",change);window.removeEventListener("offline",change);document.removeEventListener("visibilitychange",change);window.removeEventListener("beforeunload",unload);};
  },[saved]);
  if(!attempt)return <ContentContainer>{error?<EmptyState title="Assessment unavailable" description={error} action={<LinkButton to="/student/history">Test history</LinkButton>}/>:<p role="status">Loading saved assessment...</p>}</ContentContainer>;
  if(attempt.state==="Submitted")return <ContentContainer><Card><PageHeader title="Test submitted"/><Notice>Your submission is stored. {attempt.kind==="FLT"?"Admin will release your result after evaluation. Speaking is assessed offline.":"Your result will appear after scoring and Writing and Speaking evaluation."}</Notice><LinkButton to="/student/history">View test history</LinkButton></Card></ContentContainer>;
  const section=attempt.practiceSkill??sections[attempt.section]??"Listening";
  const answers=Object.fromEntries(Object.entries(attempt.answers).filter(([key])=>key.startsWith(section+":")).map(([key,value])=>[key.slice(section.length+1),value]));
  const setAnswer=(key:string,value:string)=>patch({answers:{...current.current!.answers,[`${section}:${key}`]:value}});
  const reload=async()=>{if(!window.confirm("Reload the server-saved answers? Changes not yet acknowledged by the server will be replaced."))return;try{const saved=withPassages(await api<TestAttempt>(`/attempts/${attempt.id}?session=${tabKey.current}`));pendingSignal.current=undefined;setWaitingForSection(false);current.current=saved;setAttempt(saved);setError("");setSaved("Saved on server");confirmed.current={remaining:saved.sectionRemainingSeconds??saved.remainingSeconds,at:performance.now()};setSeconds(confirmed.current.remaining);}catch(e){setError(e instanceof Error?e.message:"Could not restore saved answers");}};
  const alerts=<>{attempt.timed !== false && seconds === 0 && <Notice>This section has ended. Move to the next section or submit the test.</Notice>}{!connected&&<Notice>Connection interrupted. The timer has stopped. Saved answers will be restored when you reconnect.</Notice>}{error&&<div role="alert" className="notice">{error}<Button variant="secondary" onClick={()=>void sendRef.current()}>Retry save</Button><Button variant="secondary" onClick={()=>void reload()}>Reload saved answers</Button></div>}</>;
  const modals=<>{confirmSection&&<Modal title={`Submit ${section} section?`} onClose={()=>{if(!busy)setConfirmSection(false);}}><div className="stack"><p>Answers in this section will be final. Unused section time will end and the next available section will open.</p><Button disabled={busy} onClick={async()=>{await sendRef.current(false,true);setConfirmSection(false);}}>Confirm section submission</Button><Button variant="ghost" disabled={busy} onClick={()=>setConfirmSection(false)}>Keep working</Button></div></Modal>}
    {confirm&&<Modal title="Submit this test?" onClose={()=>setConfirm(false)}><div className="stack"><p>Submitted answers cannot be edited. This uses the attempt already started.</p><Button disabled={busy} onClick={async()=>{await sendRef.current(true);setConfirm(false);}}>Confirm submission</Button><Button variant="ghost" onClick={()=>setConfirm(false)}>Keep working</Button></div></Modal>}</>;
  const locked=!connected||busy||waitingForSection||(attempt.timed !== false && seconds===0);
  if(attempt.kind!=="PRACTICE")return <div className={`test-display test-theme-${attempt.theme} test-font-${attempt.fontSize}`}>
    <TestScreen attempt={attempt} section={section as "Listening"|"Reading"|"Writing"|"Speaking"} answers={answers} setAnswer={setAnswer} seconds={seconds} connected={connected} saved={saved} locked={locked}
      institution={platform.institutionName} candidate={students.find(s=>s.id===attempt.studentId)?.name ?? "Test taker"}
      onSelect={question=>{if(current.current?.question!==question)patch({question});}} onSave={()=>void sendRef.current()} onSubmitSection={()=>setConfirmSection(true)} onSubmitTest={()=>setConfirm(true)} onDisplay={patch} alerts={alerts} onAudioProgress={(part,ms)=>{audioPosition.current={audioPart:part,audioMs:ms};}}/>
    {modals}</div>;
  return <div><ContentContainer>
    <div className="exam-toolbar"><div className="actions">{attempt.timed === false ? <Badge>Untimed practice</Badge> : <strong aria-label="Time remaining">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}</strong>}</div></div>
    <PageHeader title={attempt.name??"Assessment"} description={`${section} / Attempt ${attempt.number}`} actions={<Badge>{saved}</Badge>}/>
    {alerts}
    <fieldset disabled={locked} className="border-0 p-0 min-w-0">{section==="Speaking"?<SpeakingPractice attemptId={attempt.id} questions={attempt.questions?.filter(q=>q.skill==="Speaking")??[]} answers={answers} setAnswer={setAnswer} locked={locked}/>:section==="Writing"?<WritingEditor course={course} drafts={answers} setDraft={setAnswer} prompts={attempt.questions?.filter(q=>q.skill==="Writing")} selectedTask={attempt.question===1?"Task 2":"Task 1"} onTaskChange={task=>patch({question:task==="Task 2"?1:0})} onlyTask={attempt.questions?.[0]?.section}/>:<ObjectivePractice skill={section} course={course} answers={answers} setAnswer={setAnswer} practice questionsOverride={attempt.questions?.filter(q=>q.skill===section)} selectedQuestion={attempt.question} onQuestionChange={question=>{if(current.current?.question!==question)patch({question});}}/>}</fieldset>
    <p className="muted text-xs">{attempt.interruptions} interruptions. The server controls saved time.</p><div className="actions"><Button variant="secondary" disabled={!connected||busy} onClick={()=>void sendRef.current()}>Save answers</Button><Button disabled={!connected||busy} onClick={()=>setConfirm(true)}>Submit test</Button></div>
    {modals}
  </ContentContainer></div>;
}
