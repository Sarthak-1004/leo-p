import {useEffect,useState} from "react";
import {api} from "../services/api";
import type {Question,Result} from "../types/domain";
import {Card,SectionTitle} from "./ui";
import {WritingFeedback} from "./WritingFeedback";
export function MarksheetResponses({id,version}:{id:string;version?:number}){
  const [record,setRecord]=useState<(Result&{responses:Record<string,string>;questions:Question[];keysWithheld?:boolean})>(),[error,setError]=useState("");
  useEffect(()=>{let active=true;api<Result&{responses:Record<string,string>;questions:Question[];keysWithheld?:boolean}>(`/results/${id}`).then(r=>{if(active){setRecord(r);setError("");}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id,version]);
  if(error)return <Card><p role="alert" className="error-text">{error}</p></Card>;
  if(!record)return <Card><p role="status">Loading submitted responses...</p></Card>;
  const latest=record.aiFeedback?.at(-1);
  // Each Writing task's answer, keyed by task name, so the feedback can highlight the student's own words.
  const writingAnswers=Object.fromEntries(record.questions.filter(q=>q.skill==="Writing").map(q=>[q.section??"",record.responses[`Writing:${q.section}`]??record.responses[`Writing:${q.id}`]??""]));
  return <Card><SectionTitle title="Submitted responses"/>{record.keysWithheld&&<p className="notice mb-4" role="note">Reference answers appear after you use both attempts on this Practice Mock Test, so your second attempt stays a fair practice.</p>}<div className="stack">{record.questions.map(q=><section className="response-record" key={q.id}><h3>{q.skill}: {q.title}</h3><p className="muted text-sm whitespace-pre-wrap">{q.prompt}</p><p className="text-sm whitespace-pre-wrap mt-3">{record.responses[`${q.skill}:${q.id}`]??record.responses[`Writing:${q.section}`]??"No response"}</p>{q.skill!=="Writing"&&q.answer!==undefined&&<p className="muted text-xs mt-2">Reference answer: {Array.isArray(q.answer)?q.answer.join(" / "):q.answer}{q.explanation&&<span className="block mt-2">{q.explanation}</span>}</p>}</section>)}{latest&&<WritingFeedback evaluation={latest} answers={writingAnswers}/>}</div></Card>;
}
