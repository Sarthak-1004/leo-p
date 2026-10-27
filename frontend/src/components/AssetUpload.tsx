import {useState} from "react";
import {api} from "../services/api";
import {usePreview} from "../app/PreviewContext";
import {Button,Modal} from "./ui";
import {MediaLibrary} from "./MediaLibrary";
export function AssetUpload({onUpload}:{onUpload:(id:string)=>void}){
  const {settings}=usePreview();
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[browse,setBrowse]=useState(false);
  return <div className="stack"><label className="field">Assessment media<input type="file" accept="audio/mpeg,audio/wav,image/png,image/jpeg,image/webp" disabled={busy} onChange={async event=>{const file=event.target.files?.[0];if(!file)return;setBusy(true);setError("");try{const body=new FormData();body.append("file",file);const asset=await api<{id:string}>("/admin/assets",{method:"POST",body});onUpload(asset.id);}catch(reason){setError(reason instanceof Error?reason.message:"Upload failed");}finally{setBusy(false);}}}/><small>{busy?"Uploading...":`PNG, JPEG, WebP, MP3 or WAV; up to ${settings.mediaLimitMb??20} MB`}</small>{error&&<span className="error-text" role="alert">{error}</span>}</label><Button variant="secondary" onClick={()=>setBrowse(true)}>Choose existing media</Button>{browse&&<Modal title="Media library" onClose={()=>setBrowse(false)}><MediaLibrary onSelect={id=>{onUpload(id);setBrowse(false);}}/></Modal>}</div>;
}
