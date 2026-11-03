import {useEffect,useMemo,useRef,useState} from "react";
import {usePreview} from "../app/PreviewContext";
import {api} from "../services/api";
import type {Course,Question,Skill} from "../types/domain";
export const QUESTION_PAGE_SIZE=50;
export type QuestionSearch={skill:Skill;course:Course;search:string;section:string;questionType:string;status:"published"|"all";page:number};
export type QuestionPage={count:number;rows:Question[];sections:string[];questionTypes:string[]};
const empty:QuestionPage={count:0,rows:[],sections:[],questionTypes:[]};
const distinct=(values:(string|undefined)[])=>[...new Set(values.filter((v):v is string=>!!v))].sort();
// Live mode searches the server so builders are not limited to the bootstrap page.
export function useQuestionSearch(query:QuestionSearch){
  const {mode,questions}=usePreview();
  const [live,setLive]=useState<QuestionPage&{loading:boolean;error:string}>({...empty,loading:true,error:""});
  const {skill,course,search,section,questionType,status,page}=query;
  const demo=useMemo(()=>{
    if(mode!=="demo")return empty;
    const scope=questions.filter(q=>q.skill===skill&&(q.course==="BOTH"||q.course===course));
    const text=search.trim().toLowerCase();
    const rows=scope.filter(q=>(!section||q.section===section)&&(!questionType||q.questionType===questionType)&&(status==="all"||(q.published&&!q.archived))&&(!text||[q.id,q.title,q.prompt].some(v=>v.toLowerCase().includes(text))));
    return {count:rows.length,rows:rows.slice((page-1)*QUESTION_PAGE_SIZE,page*QUESTION_PAGE_SIZE),sections:distinct(scope.map(q=>q.section)),questionTypes:distinct(scope.map(q=>q.questionType))};
  },[mode,questions,skill,course,search,section,questionType,status,page]);
  useEffect(()=>{
    if(mode==="demo")return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      const params=new URLSearchParams({skill,course,status,page:String(page),limit:String(QUESTION_PAGE_SIZE),...(search.trim()?{search:search.trim()}:{}),...(section?{section}:{}),...(questionType?{questionType}:{})});
      setLive(old=>({...old,loading:true}));
      api<QuestionPage>(`/admin/questions?${params}`,{signal:controller.signal})
        .then(result=>setLive({...result,loading:false,error:""}))
        .catch(e=>{if(!controller.signal.aborted)setLive(old=>({...old,loading:false,error:e instanceof Error?e.message:"Questions could not be loaded"}));});
    },250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[mode,skill,course,search,section,questionType,status,page]);
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
