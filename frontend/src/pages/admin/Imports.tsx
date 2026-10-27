import {ImportPanel} from "../../components/ImportPanel";
import {ContentContainer,PageHeader} from "../../components/ui";
import {usePreview} from "../../app/PreviewContext";
export function ContentImports(){const {mode}=usePreview();return <ContentContainer><PageHeader title="Content import" description="Import client-supplied question content and answer keys."/>{mode==="live"?<><ImportPanel kind="questions"/><ImportPanel kind="tests"/></>:<p>Server-side imports are available in the connected application.</p>}</ContentContainer>;}
