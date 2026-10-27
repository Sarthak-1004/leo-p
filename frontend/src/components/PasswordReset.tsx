import {useState} from "react";
import {usePreview} from "../app/PreviewContext";
import {api} from "../services/api";
import {Button,Modal,Notice} from "./ui";
export function PasswordReset({id,onClose}:{id:string;onClose:()=>void}){
  const {mode}=usePreview();const [error,setError]=useState(""),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
  return <Modal title="Reset account password" onClose={onClose}>{mode==="demo"?<Notice>Password resets are unavailable in demo mode.</Notice>:done?<div className="stack"><Notice>Password changed. Previous sessions have been revoked.</Notice><Button onClick={onClose}>Done</Button></div>:<form className="stack" onSubmit={async event=>{event.preventDefault();const form=event.currentTarget;const secret=String(new FormData(form).get("password"));setBusy(true);try{await api(`/admin/users/${encodeURIComponent(id)}/password`,{method:"POST",body:{password:secret}});form.reset();setDone(true);}catch(reason){setError(reason instanceof Error?reason.message:"Password reset failed");}finally{setBusy(false);}}}><label className="field">New password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label><p className="muted text-xs">Deliver the password to the account holder through your office's approved process.</p><Button type="submit" disabled={busy}>Reset password</Button>{error&&<p role="alert" className="error-text">{error}</p>}</form>}</Modal>;
}
