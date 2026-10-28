import { useEffect,useRef,useState,type ReactNode } from "react";
import { PortalContext,type PreviewState,type PreviewValue,type SessionUser } from "./context";
import { api,ApiError,setCsrf } from "../services/api";
import type { Result,TestAttempt,Question } from "../types/domain";
import {ReauthGate} from "../components/ReauthGate";
const empty:PreviewState={students:[],trainers:[],tests:[],questions:[],results:[],progress:[],attempts:[],practiceRecords:[],notifications:[],auditEvents:[],settings:{institutionName:"Kanan IELTS Practice Portal",interruptionLimit:3,leaderboard:false}};
export function LiveProvider({children}:{children:ReactNode}) {
  const [data,setData]=useState(empty);const [currentUser,setUser]=useState<SessionUser>();
  const [authStatus,setAuth]=useState<PreviewValue["authStatus"]>("loading");const [status,setStatus]=useState<PreviewValue["status"]>("loading");
  const [error,setError]=useState("");const [operations,setOperations]=useState(0);const alive=useRef(true);const sessionEpoch=useRef(0);
  async function refresh(){const epoch=sessionEpoch.current;const state=await api<PreviewState>("/bootstrap");if(alive.current&&epoch===sessionEpoch.current){setData(state);setStatus("ready");}}
  async function acceptSession(session:{user:SessionUser;csrfToken:string}){setCsrf(session.csrfToken);setUser(session.user);setAuth("authenticated");if(session.user.accessActive)await refresh();else setStatus("ready");}
  useEffect(()=>{
    alive.current=true;const initialEpoch=++sessionEpoch.current;
    void api<Partial<PreviewState["settings"]>>("/institution").then(institution=>{if(alive.current)setData(old=>({...old,settings:{...old.settings,...institution}}));}).catch(()=>{});
    const expired=()=>{sessionEpoch.current++;setAuth("anonymous");setUser(undefined);setData(empty);setCsrf("");};window.addEventListener("kanan-session-expired",expired);
    api<{user:SessionUser;csrfToken:string}>("/auth/me").then(async session=>{
      if(!alive.current||initialEpoch!==sessionEpoch.current)return;setCsrf(session.csrfToken);setUser(session.user);setAuth("authenticated");if(session.user.accessActive)await refresh();else setStatus("ready");
    }).catch(reason=>{if(!alive.current||initialEpoch!==sessionEpoch.current)return;if(reason instanceof ApiError&&reason.status===401){setAuth("anonymous");setStatus("ready");}else{setError(reason.message);setAuth("anonymous");setStatus("error");}});
    return()=>{alive.current=false;window.removeEventListener("kanan-session-expired",expired);};
  },[]);
  async function mutation(path:string,method:string,body?:unknown):Promise<boolean>{setOperations(n=>n+1);setError("");try{await api(path,{method,body});await refresh();return true;}catch(reason){setError(reason instanceof Error?reason.message:"The change could not be saved");return false;}finally{setOperations(n=>n-1);}}
  const evaluationBody=(r:Result,remarks:string,draft=false)=>({version:r.version,listening:r.listening,reading:r.reading,writing:r.writing,...(r.speakingCriteria?{speakingCriteria:r.speakingCriteria,speakingDate:r.speakingDate}:{}),remarks,completed:r.reviewStatus==="Completed",draft});
  const value:PreviewValue={...data,mode:"live",currentUser,authStatus,pending:operations>0,error,clearError:()=>setError(""),status,
    loadMore:async()=>{const epoch=sessionEpoch.current;setOperations(n=>n+1);try{const more=await api<PreviewState>(`/bootstrap?offset=${data.nextOffset??500}`);if(epoch!==sessionEpoch.current)return;setData(old=>{const next={...old,hasMore:more.hasMore,nextOffset:more.nextOffset};for(const key of ["students","trainers","questions","results","attempts","notifications","auditEvents"] as const){const values=new Map<string,unknown>();for(const item of [...old[key],...more[key]])values.set(item.id,item);(next[key] as unknown)= [...values.values()];}return next;});}catch(e){setError(e instanceof Error?e.message:"Records could not be loaded");}finally{setOperations(n=>n-1);}},
    course:currentUser?.course??"GENERAL",setCourse:()=>{},trainerId:currentUser?.role==="trainer"?currentUser.id:"",setTrainerId:()=>{},refresh,
    retry:()=>{setStatus("loading");void refresh().catch(e=>{setError(e.message);setStatus("error");});},
    login:async(role,identifier,password)=>{const epoch=++sessionEpoch.current;setStatus("loading");const session=await api<{user:SessionUser;csrfToken:string}>("/auth/login",{method:"POST",body:{role,identifier,password}});if(epoch!==sessionEpoch.current)return;if(!session.user||!session.csrfToken)throw new Error("Sign-in service is updating. Try again shortly.");await acceptSession(session);},
    logout:async()=>{sessionEpoch.current++;try{await api("/auth/logout",{method:"POST"});setCsrf("");setUser(undefined);setData(empty);setAuth("anonymous");setStatus("ready");}catch(e){setError(e instanceof Error?e.message:"Sign out failed. Try again");}},
    updateStudent:s=>mutation(`/admin/students/${encodeURIComponent(s.id)}`,"PUT",{id:s.id,name:s.name,course:s.course,startDate:s.startDate,expiryDate:s.expiryDate,enabled:s.enabled,trainerId:s.trainerId??null,movePending:s.movePending??false,...(s.password?{password:s.password}:{}),...(s.contacts?{contacts:s.contacts}:{})}),
    updateTrainer:t=>mutation(`/admin/trainers/${encodeURIComponent(t.id)}`,"PUT",{...t}),
    updateQuestion:async q=>{setOperations(n=>n+1);try{const saved=await api<Question>(`/admin/questions/${encodeURIComponent(q.id)}`,{method:"PUT",body:{...q,questionType:q.questionType??"",section:q.section??"",difficulty:q.difficulty??"Medium"}});await refresh();return saved;}catch(e){setError(e instanceof Error?e.message:"Question could not be saved");return false;}finally{setOperations(n=>n-1);}},
    updateTest:t=>{const {id,course,kind,number,published,available,duration,builder,version,conversions}=t;const input={id,course,kind,number,published,available,duration,builder,version};const old=data.tests.find(old=>old.id===t.id&&old.course===t.course);return mutation(`/admin/tests/${t.course}/${encodeURIComponent(t.id)}`,"PUT",{...input,available:t.kind==="FLT"?t.available:false,...(JSON.stringify(conversions)!==JSON.stringify(old?.conversions)?{conversions}:{})});},
    updateSettings:s=>mutation("/admin/settings","PUT",s),
    updateResult:r=>{const draft=r.evaluationDraft;return draft?mutation(`/results/${r.id}/evaluation`,"PUT",evaluationBody({...r,...draft},draft.remarks,true)):Promise.resolve(false);},
    reviseResult:(r,_actor,remarks)=>mutation(`/results/${r.id}/evaluation`,"PUT",evaluationBody(r,remarks)),
    releaseResults:async ids=>{setOperations(n=>n+1);try{const response=await api<{released:string[]}>("/results/release",{method:"POST",body:{ids}});await refresh();return response.released.length;}catch(e){setError(e instanceof Error?e.message:"Release failed");return 0;}finally{setOperations(n=>n-1);}},
    markNotificationRead:id=>mutation(`/notifications/${id}/read`,"POST"),addAudit:()=>{},addPracticeRecord:()=>{},updateAttempt:()=>{},
    startAttempt:async test=>{try{const attempt=await api<TestAttempt>(`/tests/${test.course}/${test.id}/start`,{method:"POST"});await refresh();return attempt;}catch(e){setError(e instanceof Error?e.message:"The test could not be started");return null;}},
  };
  return <PortalContext.Provider value={value}>{children}<ReauthGate/></PortalContext.Provider>;
}
