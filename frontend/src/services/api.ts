let csrfToken="";
export const setCsrf=(token:string)=>{csrfToken=token;};
let reauthenticate:(()=>Promise<void>)|undefined;
export const setReauthHandler=(handler:(()=>Promise<void>)|undefined)=>{reauthenticate=handler;};
export class ApiError extends Error { status:number; constructor(message:string,status:number){super(message);this.status=status;} }
export async function api<T>(path:string,options:{method?:string;body?:unknown;signal?:AbortSignal}={},retried=false):Promise<T> {
  const multipart=options.body instanceof FormData;
  const response=await fetch(`/api${path}`,{method:options.method??"GET",credentials:"same-origin",headers:{...(options.body&&!multipart?{"Content-Type":"application/json"}:{}),...(options.method&&options.method!=="GET"?{"X-CSRF-Token":csrfToken}:{})},body:options.body===undefined?undefined:multipart?options.body as FormData:JSON.stringify(options.body),signal:options.signal??AbortSignal.timeout(20000)});
  const body=await response.json().catch(()=>({message:"The server returned an unexpected response"}));
  if(response.status===403&&body.code==="REAUTH_REQUIRED"&&!retried&&reauthenticate&&!path.startsWith("/auth/")){await reauthenticate();return api<T>(path,options,true);}
  if(!response.ok){if(response.status===401&&!path.startsWith("/auth/"))window.dispatchEvent(new Event("kanan-session-expired"));throw new ApiError(body.message??"The request failed",response.status);}
  return body as T;
}
