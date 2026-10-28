import type {Db} from "./db.js";
import type {Config} from "./config.js";
import {platformSettings} from "./settings.js";
import {today} from "./domain.js";
export async function maintain(db:Db,config:Config,now=new Date()){
  await db.session.deleteMany({where:{expiresAt:{lt:now}}});
  await db.authChallenge.deleteMany({where:{expiresAt:{lt:now}}});
  await db.loginThrottle.deleteMany({where:{resetAt:{lt:now}}});
  const settings=await platformSettings(db);
  const day=today(config.ACCESS_TIMEZONE,now);
  const students=await db.student.findMany({where:{user:{enabled:true},expiryDate:{gte:day}},select:{id:true,expiryDate:true}});
  const rows=[];
  for(const s of students){const days=Math.round((new Date(`${s.expiryDate}T00:00:00Z`).getTime()-new Date(`${day}T00:00:00Z`).getTime())/86400000);if(settings.expiryReminders&&(days===1||days===7))rows.push({userId:s.id,dedupeKey:`expiry/${s.id}/${s.expiryDate}/${days}`,title:`Your portal access expires in ${days} ${days===1?"day":"days"}. Contact the Kanan office for assistance.`,href:"/student/profile"});}
  const pending=await db.result.count({where:{kind:"FLT",reviewStatus:{not:"Completed"}}});
  if(settings.backlogNotifications&&pending){const admins=await db.user.findMany({where:{role:"ADMIN",enabled:true},select:{id:true}});for(const admin of admins)rows.push({userId:admin.id,dedupeKey:`backlog/${admin.id}/${day}`,title:`${pending} evaluations are waiting for review.`,href:"/admin/results"});}
  if(rows.length)await db.notification.createMany({data:rows,skipDuplicates:true});
}
