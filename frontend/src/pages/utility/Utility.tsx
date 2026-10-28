import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import {
  Badge,
  Button,
  Card,
  ContentContainer,
  EmptyState,
  ErrorState,
  LinkButton,
  LoadingState,
  PageHeader,
  Tabs,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import {api} from "../../services/api";
export function Login({ admin = false, trainer = false }: { admin?: boolean; trainer?: boolean }) {
  const {mode,login,finishMfa,currentUser,error:connectionError}=usePreview();
  const navigate=useNavigate();
  const [showPassword,setShowPassword]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const [mfa,setMfa]=useState<{role:string;enrollmentRequired:boolean}>(),[setup,setSetup]=useState<{secret:string;qrDataUrl:string}>(),[codes,setCodes]=useState<string[]>([]);
  const role=admin?"admin":trainer?"trainer":"student";
  const verifying=mfa?.role===role;
  if(mode==="live"&&currentUser)return <Navigate to={currentUser.accessActive?`/${currentUser.role}/dashboard`:"/student/access-expired"} replace/>;
  return <div className="auth-page"><aside className={`auth-aside ${admin?"admin":""}`}><strong className="text-xl tracking-wider">KANAN</strong><div><h1>{admin?"A clear view of every student's journey.":trainer?"Thoughtful review. Meaningful progress.":"Your next chapter starts with practice."}</h1><p>{admin?"Manage students, content and assessments.":trainer?"Review marksheets and assess Speaking offline.":"Practise Listening, Reading and Writing. Take Speaking with your trainer."}</p></div><footer>General Training & Academic</footer></aside><main className="auth-main"><div className="auth-form">
    {mode==="demo"&&<Badge>Frontend preview</Badge>}<h1>{admin?"Admin login":trainer?"Trainer login":"Welcome back"}</h1><p className="muted auth-intro">Use the credentials provided by the Kanan office.</p>
    {!verifying?<form className="stack" onSubmit={async event=>{event.preventDefault();const form=event.currentTarget;const values=new FormData(form);if(mode==="demo"){setMessage("Authentication is not connected in demo mode. Use the preview link.");form.reset();return;}setBusy(true);setMessage("");try{const result=await login(role,String(values.get("identifier")),String(values.get("password")));form.reset();if(result?.mfaRequired){setMfa({role,enrollmentRequired:result.enrollmentRequired});setCodes([]);if(result.enrollmentRequired)setSetup(await api("/auth/mfa/enroll",{method:"POST",body:{}}));return;}navigate(`/${role}/dashboard`,{replace:true});}catch(reason){setMessage(reason instanceof Error?reason.message:"Sign in failed");}finally{setBusy(false);}}}>
    <label className="field">{admin?"Admin ID":trainer?"Trainer ID or email":"Student ID"}<input name="identifier" autoComplete="username" required maxLength={200}/></label><div className="field"><label htmlFor={`${role}-password`}>Password</label><div className="password-control"><input id={`${role}-password`} name="password" type={showPassword?"text":"password"} autoComplete="current-password" required maxLength={128}/><button type="button" className="icon-button password-toggle" aria-label={showPassword?"Hide password":"Show password"} title={showPassword?"Hide password":"Show password"} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}><Icon name={showPassword?"eye-off":"eye"}/></button></div></div><Button type="submit" disabled={busy}>{busy?"Signing in...":"Sign in"}<Icon name="arrow" size={16}/></Button></form>:codes.length?<div className="stack"><h2>Save your recovery codes</h2><p>Keep these private and separate from your password. Each code works once.</p><div className="form-grid">{codes.map(code=><code key={code}>{code}</code>)}</div><form className="stack" onSubmit={async event=>{event.preventDefault();setBusy(true);setMessage("");try{await finishMfa?.();}catch(e){setMessage(e instanceof Error?e.message:"Sign in failed");}finally{setBusy(false);}}}><label className="row"><input type="checkbox" required/>I saved my recovery codes</label><Button disabled={busy} type="submit">Continue to portal</Button></form></div>:<form className="stack" onSubmit={async event=>{event.preventDefault();const form=event.currentTarget,code=String(new FormData(form).get("code"));setBusy(true);setMessage("");try{const result=await finishMfa?.(code);form.reset();if(result?.recoveryCodes){setCodes(result.recoveryCodes);setSetup(undefined);}}catch(e){setMessage(e instanceof Error?e.message:"Verification failed");}finally{setBusy(false);}}}><h2>{mfa.enrollmentRequired?"Set up two-step sign-in":"Two-step sign-in"}</h2>{setup&&<><p>Scan with your authenticator app, or enter the setup key.</p><img src={setup.qrDataUrl} alt="Authenticator app setup QR code" width={220} height={220} className="max-w-full"/><label className="field">Authenticator setup key<input value={setup.secret} readOnly autoComplete="off"/></label></>}<label className="field">Authenticator or recovery code<input name="code" autoComplete="one-time-code" required minLength={6} maxLength={40} spellCheck={false}/></label><Button type="submit" disabled={busy||!!(mfa.enrollmentRequired&&!setup)}>Verify and continue</Button></form>}
    {verifying&&<Button variant="ghost" disabled={busy} onClick={()=>{setMfa(undefined);setSetup(undefined);setCodes([]);setMessage("");}}>Start sign-in again</Button>}
    {(message||connectionError)&&<p role="alert" className="error-text">{message||connectionError}</p>}
    {mode==="demo"&&<LinkButton secondary to={`/${role}/dashboard`}>Open {role} preview</LinkButton>}
    {!admin&&!trainer&&<p className="muted text-xs">Need account assistance? Contact the Kanan office.</p>}
    <div className="actions auth-role-links">{["student","trainer","admin"].filter(value=>value!==role).map(value=><Link className="table-link text-xs" key={value} to={`/${value}/login`}>{value[0].toUpperCase()+value.slice(1)} login</Link>)}</div>
  </div></main></div>;
}
export function NotFound() {
  return (
    <ContentContainer>
      <Card>
        <EmptyState
          title="Page not found"
          description="The page may have moved or the address may be incorrect."
          action={
            <LinkButton to="/student/dashboard">Go to dashboard</LinkButton>
          }
        />
      </Card>
    </ContentContainer>
  );
}
export function StatePreview() {
  const [state, setState] = useState("Loading");
  return (
    <ContentContainer>
      <PageHeader
        title="Interface state preview"
        description="Review shared loading, empty and error components."
      />
      <Tabs
        options={["Loading", "Empty", "Error"]}
        value={state}
        onChange={setState}
        label="State preview"
      />
      {state === "Loading" ? (
        <LoadingState />
      ) : state === "Empty" ? (
        <Card>
          <EmptyState />
        </Card>
      ) : (
        <ErrorState retry={() => setState("Loading")} />
      )}
    </ContentContainer>
  );
}
