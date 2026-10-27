import {useState} from "react";
import {usePreview} from "../app/PreviewContext";
import type {MockTest} from "../types/domain";
import {Button,Card,Notice,SectionTitle} from "./ui";
const names=["Listening","AcademicReading","GeneralReading"] as const;
export function ConversionEditor({test}:{test:MockTest}){
  const {updateTest,pending}=usePreview();
  const [values,setValues]=useState<Record<string,string[]>>(()=>Object.fromEntries(names.map(name=>[name,Array.from({length:41},(_,raw)=>{const band=test.conversions?.[name]?.find(([minimum])=>raw>=minimum)?.[1];return band===undefined?"":String(band);})])));
  const [message,setMessage]=useState("");
  return <Card><SectionTitle title="Band conversion tables"/><p className="muted text-sm mb-5">Supply a band for every raw score before publishing. Listening is shared; Reading differs by course. Missing lower conversions must be supplied by Admin.</p><form className="stack" onSubmit={async event=>{event.preventDefault();const conversions=Object.fromEntries(names.map(name=>[name,Array.from({length:41},(_,i)=>[40-i,Number(values[name]![40-i]) ] as [number,number])]));if((await updateTest({...test,conversions}))!==false)setMessage("Conversion table version saved. Existing attempts keep their original conversion tables.");}}><div className="table-wrap"><table><thead><tr><th>Raw / 40</th>{names.map(name=><th key={name}>{name.replace("Reading"," Reading")}</th>)}</tr></thead><tbody>{Array.from({length:41},(_,i)=>40-i).map(raw=><tr key={raw}><th>{raw}</th>{names.map(name=><td key={name}><input aria-label={`${name} raw ${raw}`} className="control" type="number" required min={0} max={9} step={0.5} value={values[name]![raw]} onChange={e=>setValues(old=>({...old,[name]:old[name]!.map((value,index)=>index===raw?e.target.value:value)}))}/></td>)}</tr>)}</tbody></table></div><Button type="submit" disabled={pending}>Save conversion tables</Button>{message&&<Notice>{message}</Notice>}</form></Card>;
}
