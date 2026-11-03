import {useRef,useState} from "react";
import {Notice} from "./ui";
// Every attached audio file plays (for example one per Listening part), in order.
export function ListeningAudio({assetIds,practice}:{assetIds:string[];practice:boolean}){
  const refs=useRef<(HTMLAudioElement|null)[]>([]);const [speed,setSpeed]=useState("1"),[error,setError]=useState(false);
  if(!assetIds.length)return <Notice>Audio has not been supplied for this assessment.</Notice>;
  const rate=practice?Number(speed):1;
  return <div className="stack"><h3>Listening audio</h3>{assetIds.map((id,i)=><div key={id}>{assetIds.length>1&&<p className="muted text-xs mb-2">Recording {i+1} of {assetIds.length}</p>}<audio ref={el=>{refs.current[i]=el;if(el)el.playbackRate=rate;}} aria-label={`Listening recording ${i+1} of ${assetIds.length}`} controls preload="metadata" controlsList={practice?undefined:"nodownload noplaybackrate"} onRateChange={e=>{if(!practice&&e.currentTarget.playbackRate!==1)e.currentTarget.playbackRate=1;}} onEnded={()=>{const next=refs.current[i+1];if(next)void next.play().catch(()=>{});}} onError={()=>setError(true)} style={{width:"100%"}} src={`/api/assets/${id}/stream`}/></div>)}{practice?<label className="field">Playback speed<select aria-label="Playback speed" value={speed} onChange={e=>{setSpeed(e.target.value);for(const el of refs.current)if(el)el.playbackRate=Number(e.target.value);}}><option value="1">1x (normal)</option><option value="1.5">1.5x</option><option value="2">2x</option></select></label>:<p className="muted">Normal speed only</p>}{error&&<p role="alert" className="error-text">Audio could not be loaded. Check your connection and try again.</p>}</div>;
}
