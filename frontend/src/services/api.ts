let csrfToken="";
export const setCsrf=(token:string)=>{csrfToken=token;};
export class ApiError extends Error { status:number; constructor(message:string,status:number){super(message);this.status=status;} }
export async function api<T>(path:string,options:{method?:string;body?:unknown;signal?:AbortSignal}={}):Promise<T> {
  const multipart=options.body instanceof FormData;
  const response=await fetch(`/api${path}`,{method:options.method??"GET",credentials:"same-origin",headers:{...(options.body&&!multipart?{"Content-Type":"application/json"}:{}),...(options.method&&options.method!=="GET"?{"X-CSRF-Token":csrfToken}:{})},body:options.body===undefined?undefined:multipart?options.body as FormData:JSON.stringify(options.body),signal:options.signal??AbortSignal.timeout(20000)});
  const body=await response.json().catch(()=>({message:"The server returned an unexpected response"}));
  if(!response.ok){if(response.status===401&&!path.startsWith("/auth/"))window.dispatchEvent(new Event("kanan-session-expired"));throw new ApiError(body.message??"The request failed",response.status);}
  return body as T;
}
