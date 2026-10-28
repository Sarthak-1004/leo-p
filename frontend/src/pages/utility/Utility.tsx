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
export function Login({ admin = false, trainer = false }: { admin?: boolean; trainer?: boolean }) {
  const {mode,login,currentUser,error:connectionError}=usePreview();
  const navigate=useNavigate();
  const [showPassword,setShowPassword]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const role=admin?"admin":trainer?"trainer":"student";
  if(mode==="live"&&currentUser)return <Navigate to={currentUser.accessActive?`/${currentUser.role}/dashboard`:"/student/access-expired"} replace/>;
  return <div className="auth-page">
    <aside className="auth-aside"><strong className="text-xl tracking-wider">KANAN</strong><div>
      <h1>{admin?"A clear view of every student's journey.":trainer?"Thoughtful review. Meaningful progress.":"Your next chapter starts with practice."}</h1>
      <p>{admin?"Manage students, content and assessments.":trainer?"Review marksheets and assess Speaking offline.":"Practise Listening, Reading and Writing. Take Speaking with your trainer."}</p>
    </div><footer>General Training & Academic</footer></aside>
    <main className="auth-main"><div className="auth-form">
      {mode==="demo"&&<Badge>Frontend preview</Badge>}
      <h1>{admin?"Admin login":trainer?"Trainer login":"Welcome back"}</h1>
      <p className="muted auth-intro">Sign in with your email or assigned ID and password.</p>
      <form className="stack" onSubmit={async event=>{
        event.preventDefault();const form=event.currentTarget,values=new FormData(form);
        if(mode==="demo"){setMessage("Authentication is not connected in demo mode. Use the preview link.");form.reset();return;}
        setBusy(true);setMessage("");
        try{await login(role,String(values.get("identifier")),String(values.get("password")));form.reset();navigate(`/${role}/dashboard`,{replace:true});}
        catch(reason){setMessage(reason instanceof Error?reason.message:"Sign in failed");}
        finally{setBusy(false);}
      }}>
        <label className="field">{admin?"Admin ID or email":trainer?"Trainer ID or email":"Student ID or email"}
          <input name="identifier" autoComplete="username" required maxLength={200}/>
        </label>
        <div className="field"><label htmlFor={`${role}-password`}>Password</label>
          <div className="password-control"><input id={`${role}-password`} name="password" type={showPassword?"text":"password"} autoComplete="current-password" required maxLength={128}/>
            <button type="button" className="icon-button password-toggle" aria-label={showPassword?"Hide password":"Show password"} title={showPassword?"Hide password":"Show password"} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}><Icon name={showPassword?"eye-off":"eye"}/></button>
          </div>
        </div>
        <Button type="submit" disabled={busy}>{busy?"Signing in...":"Sign in"}<Icon name="arrow" size={16}/></Button>
      </form>
      {(message||connectionError)&&<p role="alert" className="error-text">{message||connectionError}</p>}
      {mode==="demo"&&<LinkButton secondary to={`/${role}/dashboard`}>Open {role} preview</LinkButton>}
      {!admin&&!trainer&&<p className="muted text-xs">Need account assistance? Contact the Kanan office.</p>}
      <div className="actions auth-role-links">{["student","trainer","admin"].filter(value=>value!==role).map(value=><Link className="table-link text-xs" key={value} to={`/${value}/login`}>{value[0].toUpperCase()+value.slice(1)} login</Link>)}</div>
    </div></main>
  </div>;
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
