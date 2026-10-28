import type {Db,Tx} from "./db.js";
import {audit} from "./auth.js";
export async function securityAlert(db:Db|Tx,event:"Repeated sign-in failures"|"MFA failures"|"Staff recovery code used"|"Staff MFA reset",target:string){
  const bucket=Math.floor(Date.now()/300000),admins=await db.user.findMany({where:{role:"ADMIN",enabled:true},select:{id:true}});
  const notified=await db.notification.createMany({data:admins.map(user=>({userId:user.id,dedupeKey:`security/${event}/${bucket}/${user.id}`,title:`Security: ${event}. Review the audit log.`,href:"/admin/audit"})),skipDuplicates:true});
  if(notified.count)await audit(db,"security-monitor",`Security: ${event}`,target,{windowMinutes:5});
}
