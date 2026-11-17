import {useEffect,useMemo,useRef,useState} from "react";
import {usePreview} from "../app/PreviewContext";
import {api} from "../services/api";
import type {Course,Question,Skill} from "../types/domain";
export const QUESTION_PAGE_SIZE=50;
export type QuestionStatus="published"|"all"|"draft"|"archived";
export type QuestionSearch={skill:Skill|"";course:Course|"";search:string;section:string;questionType:string;status:QuestionStatus;page:number;order?:"section"|"title"|"id";limit?:number;reload?:number};
export type QuestionPage={count:number;rows:Question[];sections:string[];questionTypes:string[]};
const empty:QuestionPage={count:0,rows:[],sections:[],questionTypes:[]};
const distinct=(values:(string|undefined)[])=>[...new Set(values.filter((v):v is string=>!!v))].sort();
// Live mode searches the server so builders are not limited to the bootstrap page.
export function useQuestionSearch(query:QuestionSearch){
  const {mode,questions}=usePreview();
  const [live,setLive]=useState<QuestionPage&{loading:boolean;error:string}>({...empty,loading:true,error:""});
  const {skill,course,search,section,questionType,status,page,order="section",limit=QUESTION_PAGE_SIZE,reload=0}=query;
  const demo=useMemo(()=>{
    if(mode!=="demo")return empty;
    const scope=questions.filter(q=>(!skill||q.skill===skill)&&(!course||q.course==="BOTH"||q.course===course));
    const text=search.trim().toLowerCase();
    const rows=scope.filter(q=>(!section||q.section===section)&&(!questionType||q.questionType===questionType)&&(status==="all"||(status==="published"&&q.published&&!q.archived)||(status==="draft"&&!q.published&&!q.archived)||(status==="archived"&&!!q.archived))&&(!text||[q.id,q.title,q.prompt].some(v=>v.toLowerCase().includes(text))));
    if(order!=="section")rows.sort((a,b)=>order==="id"?a.id.localeCompare(b.id):a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
    return {count:rows.length,rows:rows.slice((page-1)*limit,page*limit),sections:distinct(scope.map(q=>q.section)),questionTypes:distinct(scope.map(q=>q.questionType))};
  },[mode,questions,skill,course,search,section,questionType,status,page,order,limit]);
  useEffect(()=>{
    if(mode==="demo")return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      const params=new URLSearchParams({...(skill?{skill}:{}),...(course?{course}:{}),status,order,page:String(page),limit:String(limit),...(search.trim()?{search:search.trim()}:{}),...(section?{section}:{}),...(questionType?{questionType}:{})});
      setLive(old=>({...old,loading:true}));
      api<QuestionPage>(`/admin/questions?${params}`,{signal:controller.signal})
        .then(result=>setLive({...result,loading:false,error:""}))
        .catch(e=>{if(!controller.signal.aborted)setLive(old=>({...old,loading:false,error:e instanceof Error?e.message:"Questions could not be loaded"}));});
    },250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[mode,skill,course,search,section,questionType,status,page,order,limit,reload]);
  return mode==="demo"?{...demo,loading:false,error:""}:live;
}
// Resolves titles/status for IDs already in a test, which may sit outside the search page.
export function useQuestionDetails(ids:string[]){
  const {mode,questions}=usePreview();
  const [fetched,setFetched]=useState<Record<string,Question>>({});
  const requested=useRef(new Set<string>());
  const key=[...new Set(ids)].sort().join(",");
  useEffect(()=>{
    if(mode==="demo"||!key)return;
    const missing=key.split(",").filter(id=>!requested.current.has(id)).slice(0,100);
    if(!missing.length)return;
    for(const id of missing)requested.current.add(id);
    api<QuestionPage>(`/admin/questions?ids=${encodeURIComponent(missing.join(","))}`)
      .then(page=>setFetched(old=>({...old,...Object.fromEntries(page.rows.map(q=>[q.id,q]))})))
      .catch(()=>{for(const id of missing)requested.current.delete(id);});
  },[mode,key]);
  const demo=useMemo(()=>mode==="demo"?Object.fromEntries(questions.map(q=>[q.id,q])):{},[mode,questions]);
  return {known:mode==="demo"?demo:fetched};
}
// The full question (key, passage, options) for editing; the search list carries a short prompt only.
export function useFullQuestion(id:string|undefined){
  const {mode,questions}=usePreview();
  const [state,setState]=useState<{id?:string;question?:Question;error:string}>({error:""});
  useEffect(()=>{
    if(mode==="demo"||!id)return;
    const controller=new AbortController();
    api<Question>(`/admin/questions/${encodeURIComponent(id)}`,{signal:controller.signal})
      .then(question=>setState({id,question,error:""}))
      .catch(e=>{if(!controller.signal.aborted)setState({id,error:e instanceof Error?e.message:"Question could not be loaded"});});
    return()=>controller.abort();
  },[mode,id]);
  if(mode==="demo")return {question:questions.find(q=>q.id===id),loading:false,error:""};
  return state.id===id?{question:state.question,loading:false,error:state.error}:{question:undefined,loading:!!id,error:""};
}
