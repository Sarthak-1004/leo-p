import {useRef,useState} from "react";
import {Notice} from "./ui";
export function ListeningAudio({assetIds,practice}:{assetIds:string[];practice:boolean}){
  const ref=useRef<HTMLAudioElement>(null);const [speed,setSpeed]=useState("1"),[error,setError]=useState(false);
  if(!assetIds.length)return <Notice>Audio has not been supplied for this assessment.</Notice>;
  return <div className="stack"><h3>Listening audio</h3><audio ref={ref} controls preload="metadata" controlsList={practice?undefined:"nodownload noplaybackrate"} onRateChange={()=>{if(!practice&&ref.current&&ref.current.playbackRate!==1)ref.current.playbackRate=1;}} onError={()=>setError(true)} style={{width:"100%"}} src={`/api/assets/${assetIds[0]}/stream`}/>{practice?<label className="field">Playback speed<select aria-label="Playback speed" value={speed} onChange={e=>{setSpeed(e.target.value);if(ref.current)ref.current.playbackRate=Number(e.target.value);}}><option value="1">1x (normal)</option><option value="1.5">1.5x</option><option value="2">2x</option></select></label>:<p className="muted">Normal speed only</p>}{error&&<p role="alert" className="error-text">Audio could not be loaded. Check your connection and try again.</p>}</div>;
}
