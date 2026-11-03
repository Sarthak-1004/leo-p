import type {Db} from "./db.js";
import type {Config} from "./config.js";
import {lockedTransaction} from "./db.js";
import {platformSettings} from "./settings.js";
import {today} from "./domain.js";
import {forceSubmit} from "./attempts.js";
export async function maintain(db:Db,config:Config,now=new Date()){
  await db.session.deleteMany({where:{expiresAt:{lt:now}}});
  await db.authChallenge.deleteMany({where:{expiresAt:{lt:now}}});
  await db.loginThrottle.deleteMany({where:{resetAt:{lt:now}}});
  await db.trustedDevice.deleteMany({where:{lastUsedAt:{lt:new Date(now.getTime()-180*86400000)}}});
  const settings=await platformSettings(db);
  const day=today(config.ACCESS_TIMEZONE,now);
  // Attempts never stay open forever: close those past the wall-clock window, and those whose
  // student lost access (expired, disabled or not yet active), scoring the saved answers.
  const stale=await db.attempt.findMany({where:{state:"IN_PROGRESS",OR:[{createdAt:{lt:new Date(now.getTime()-settings.attemptWindowHours*3600000)}},{student:{user:{enabled:false}}},{student:{expiryDate:{lt:day}}},{student:{startDate:{gt:day}}}]},select:{id:true,createdAt:true},take:200});
  for(const a of stale){
    const reason=a.createdAt.getTime()<now.getTime()-settings.attemptWindowHours*3600000?`Open longer than ${settings.attemptWindowHours} hours`:"Student access became inactive";
    await lockedTransaction(db,tx=>forceSubmit(tx,a.id,"system",reason));
  }
  const students=await db.student.findMany({where:{user:{enabled:true},expiryDate:{gte:day}},select:{id:true,expiryDate:true}});
  const rows=[];
  for(const s of students){const days=Math.round((new Date(`${s.expiryDate}T00:00:00Z`).getTime()-new Date(`${day}T00:00:00Z`).getTime())/86400000);if(settings.expiryReminders&&(days===1||days===7))rows.push({userId:s.id,dedupeKey:`expiry/${s.id}/${s.expiryDate}/${days}`,title:`Your portal access expires in ${days} ${days===1?"day":"days"}. Contact the Kanan office for assistance.`,href:"/student/profile"});}
  const pending=await db.result.count({where:{kind:"FLT",reviewStatus:{not:"Completed"}}});
  if(settings.backlogNotifications&&pending){const admins=await db.user.findMany({where:{role:"ADMIN",enabled:true},select:{id:true}});for(const admin of admins)rows.push({userId:admin.id,dedupeKey:`backlog/${admin.id}/${day}`,title:`${pending} evaluations are waiting for review.`,href:"/admin/results"});}
  if(rows.length)await db.notification.createMany({data:rows,skipDuplicates:true});
}
