import {useEffect,useRef,useState} from "react";
import {api,setReauthHandler} from "../services/api";
import {Button,Modal} from "./ui";
export function ReauthGate(){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const pending=useRef<{promise:Promise<void>;resolve:()=>void;reject:(error:Error)=>void}|undefined>(undefined);
  useEffect(()=>{
    setReauthHandler(()=>{if(pending.current)return pending.current.promise;
      let resolve:()=>void=()=>{},reject:(error:Error)=>void=()=>{};
      const promise=new Promise<void>((ok,fail)=>{resolve=ok;reject=fail;});pending.current={promise,resolve,reject};setError("");setOpen(true);return promise;});
    const cancel=()=>{pending.current?.reject(new Error("Verification ended. Sign in again"));pending.current=undefined;setOpen(false);};
    window.addEventListener("kanan-session-expired",cancel);
    return()=>{setReauthHandler(undefined);pending.current?.reject(new Error("Verification ended"));pending.current=undefined;window.removeEventListener("kanan-session-expired",cancel);};
  },[]);
  if(!open)return null;
  function cancel(){if(busy)return;pending.current?.reject(new Error("Verification cancelled; no change was saved"));pending.current=undefined;setOpen(false);}
  return <Modal title="Confirm this sensitive action" onClose={cancel}><form className="stack" onSubmit={async event=>{
    event.preventDefault();const form=event.currentTarget,values=new FormData(form);setBusy(true);setError("");
    try{await api("/auth/reauth",{method:"POST",body:{password:String(values.get("password"))}});form.reset();const task=pending.current;pending.current=undefined;setOpen(false);task?.resolve();}
    catch(e){form.reset();setError(e instanceof Error?e.message:"Verification failed");}finally{setBusy(false);}
  }}><p>Enter your password to confirm this action. Verification lasts five minutes.</p><label className="field">Password<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label>{error&&<p role="alert" className="error-text">{error}</p>}<div className="actions"><Button type="submit" disabled={busy}>Verify action</Button><Button type="button" variant="ghost" disabled={busy} onClick={cancel}>Cancel</Button></div></form></Modal>;
}
