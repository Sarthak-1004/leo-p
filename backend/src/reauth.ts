import type {Db} from "./db.js";
import {transaction} from "./db.js";
import {audit,throttle,verifyPassword,type Authenticated} from "./auth.js";
import {assert} from "./domain.js";

export async function reauthenticate(db:Db,auth:Authenticated,password:string){
  assert(auth.user.role!=="STUDENT",403,"Staff verification required");
  await throttle(db,`reauth:${auth.user.id}`,5,300);
  assert(await verifyPassword(password,auth.user.passwordHash),401,"Verification failed");
  return transaction(db,async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${auth.user.id} FOR UPDATE`;
    const user=await tx.user.findUniqueOrThrow({where:{id:auth.user.id}});
    assert(user.enabled&&user.role!=="STUDENT"&&user.authVersion===auth.user.authVersion,401,"Sign in again");
    const session=await tx.session.findUnique({where:{tokenHash:auth.tokenHash}});
    assert(session&&session.expiresAt>new Date()&&session.authVersion===user.authVersion,401,"Sign in again");
    const until=new Date(Date.now()+300000);
    await tx.session.update({where:{tokenHash:auth.tokenHash},data:{reauthUntil:until}});
    await audit(tx,user.id,"Sensitive-action password confirmed",user.id);
    return {until:until.toISOString()};
  });
}
