import {useState} from "react";
import {usePreview} from "../../app/PreviewContext";
import {AssetUpload} from "../../components/AssetUpload";
import {MediaLibrary} from "../../components/MediaLibrary";
import {Card,ContentContainer,Notice,PageHeader,SectionTitle} from "../../components/ui";
export function Media(){const {mode}=usePreview();const [revision,setRevision]=useState(0),[selected,setSelected]=useState("");return <ContentContainer><PageHeader title="Assessment media" description="Private Listening audio and task images. Files can be reused across questions."/>{mode==="demo"?<Notice>Media storage is available in connected mode.</Notice>:<><Card><SectionTitle title="Upload media"/><AssetUpload onUpload={id=>{setSelected(id);setRevision(n=>n+1);}}/>{selected&&<Notice>File ID: {selected}. Attach it through the question editor or include it in the import's assetIds.</Notice>}</Card><Card><MediaLibrary revision={revision} onSelect={id=>setSelected(id)}/></Card></>}</ContentContainer>;}
