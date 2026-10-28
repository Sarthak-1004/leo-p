import {createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
import {Secret,TOTP} from "otpauth";
import QRCode from "qrcode";
import type {FastifyRequest} from "fastify";
import type {Db,Tx} from "./db.js";
import {transaction} from "./db.js";
import type {Config} from "./config.js";
import {audit,digest,sessionFor,throttle,verifyPassword,type Authenticated,type Identity} from "./auth.js";
import {assert,ApiError} from "./domain.js";
import {securityAlert} from "./security.js";

function encryptionKey(config:Config){assert(config.MFA_ENCRYPTION_KEY,503,"Staff security configuration is not ready. Contact the deployment owner");const key=Buffer.from(config.MFA_ENCRYPTION_KEY,"base64");assert(key.length===32,503,"Staff security configuration is invalid");return key;}
export function encryptMfa(secret:string,userId:string,config:Config){
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(config),iv);cipher.setAAD(Buffer.from(`kanan-mfa:${userId}`));
  const bytes=Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]);return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),bytes.toString("base64url")].join(".");
}
function decryptMfa(value:string,userId:string,config:Config){
  try{const [version,iv,tag,data,...extra]=value.split(".");assert(version==="v1"&&iv&&tag&&data&&!extra.length,503,"Invalid security key");const decipher=createDecipheriv("aes-256-gcm",encryptionKey(config),Buffer.from(iv,"base64url"));decipher.setAAD(Buffer.from(`kanan-mfa:${userId}`));decipher.setAuthTag(Buffer.from(tag,"base64url"));return Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8");}
  catch{throw new ApiError(503,"Staff security key is unavailable. Contact the deployment owner");}
}
function totp(secret:string,userId:string){return new TOTP({issuer:"Kanan IELTS",label:userId,algorithm:"SHA1",digits:6,period:30,secret:Secret.fromBase32(secret)});}
export async function beginMfa(db:Db,user:Identity,config:Config){
  encryptionKey(config);const token=randomBytes(32).toString("base64url"),csrfToken=randomBytes(32).toString("base64url");
  await db.authChallenge.create({data:{tokenHash:digest(token),userId:user.id,authVersion:user.authVersion,mfaVersion:user.mfaVersion,csrfToken,expiresAt:new Date(Date.now()+300000)}});
  return {token,csrfToken,enrollmentRequired:!user.mfaSecret};
}
async function challenge(db:Db|Tx,req:FastifyRequest,config:Config){
  assert(req.headers.origin===config.APP_ORIGIN,403,"Request origin is not permitted");const token=req.cookies.kanan_mfa;
  assert(token&&token.length<=256,401,"Two-step sign-in expired. Sign in again");
  const c=await db.authChallenge.findUnique({where:{tokenHash:digest(token)},include:{user:{include:{student:true}}}});
  assert(c&&c.expiresAt>new Date()&&c.user.enabled&&c.user.role!=="STUDENT"&&c.authVersion===c.user.authVersion&&c.mfaVersion===c.user.mfaVersion,401,"Two-step sign-in expired. Sign in again");
  assert(req.headers["x-csrf-token"]===c.csrfToken,403,"Refresh sign-in before continuing");return c;
}
export async function enrollMfa(db:Db,req:FastifyRequest,config:Config){
  const c=await challenge(db,req,config);assert(!c.user.mfaSecret&&!c.verifiedAt,409,"Authenticator setup is already complete");
  await throttle(db,`mfa-enroll:${c.userId}`,5,300);
  // Repeated loads return the same setup secret; concurrent requests use CAS.
  const secret=new Secret({size:20}).base32;
  await db.authChallenge.updateMany({where:{tokenHash:c.tokenHash,secretCipher:null,verifiedAt:null},data:{secretCipher:encryptMfa(secret,c.userId,config)}});
  const saved=await db.authChallenge.findUniqueOrThrow({where:{tokenHash:c.tokenHash}}),setupSecret=decryptMfa(saved.secretCipher!,c.userId,config),uri=totp(setupSecret,c.userId).toString();
  return {secret:setupSecret,qrDataUrl:await QRCode.toDataURL(uri,{width:220,margin:2}),expiresAt:c.expiresAt.toISOString()};
}
async function consumeFactor(tx:Tx,user:Identity,code:string,config:Config){
  const normalized=code.trim().toLowerCase().replaceAll("-","");
  if(/^[a-f0-9]{20}$/.test(normalized)){
    const used=await tx.recoveryCode.updateMany({where:{hash:digest(`${user.id}:${normalized}`),userId:user.id,usedAt:null},data:{usedAt:new Date()}});
    assert(used.count===1,401,"The verification code is invalid or already used");await audit(tx,user.id,"MFA recovery code used",user.id);await securityAlert(tx,"Staff recovery code used",user.id);return;
  }
  assert(/^\d{6}$/.test(code)&&user.mfaSecret,401,"The verification code is invalid or already used");
  const now=Date.now(),delta=totp(decryptMfa(user.mfaSecret,user.id,config),user.id).validate({token:code,window:1,timestamp:now});
  assert(delta!==null,401,"The verification code is invalid or already used");const counter=Math.floor(now/30000)+delta;
  assert(counter>user.mfaLastCounter,401,"This code was already used. Wait for the next authenticator code");
  await tx.user.update({where:{id:user.id},data:{mfaLastCounter:counter}});
}
export async function verifyMfa(db:Db,req:FastifyRequest,config:Config,code:string){
  const initial=await challenge(db,req,config);await throttle(db,`mfa-factor:${initial.userId}`,5,300);
  try{const result=await transaction(db,async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${initial.userId} FOR UPDATE`;
    const c=await challenge(tx,req,config);assert(!c.verifiedAt,409,"Confirm that your recovery codes are saved");
    if(!c.user.mfaSecret){
      assert(c.secretCipher&&/^\d{6}$/.test(code),401,"Set up your authenticator before verifying");
      const now=Date.now(),secret=decryptMfa(c.secretCipher,c.userId,config),delta=totp(secret,c.userId).validate({token:code,window:1,timestamp:now});assert(delta!==null,401,"The verification code is invalid");
      const recoveryCodes=Array.from({length:10},()=>randomBytes(10).toString("hex").match(/.{5}/g)!.join("-"));
      await tx.loginThrottle.deleteMany({where:{key:{in:[`mfa-factor:${c.userId}`,`mfa-failed:${c.userId}`]}}});
      await tx.user.update({where:{id:c.userId},data:{mfaSecret:c.secretCipher,mfaVersion:{increment:1},mfaLastCounter:Math.floor(now/30000)+delta}});
      await tx.recoveryCode.deleteMany({where:{userId:c.userId}});await tx.recoveryCode.createMany({data:recoveryCodes.map(code=>({userId:c.userId,hash:digest(`${c.userId}:${code.replaceAll("-","")}`)}))});
      await tx.session.deleteMany({where:{userId:c.userId}});
      await tx.authChallenge.update({where:{tokenHash:c.tokenHash},data:{mfaVersion:c.mfaVersion+1,secretCipher:null,verifiedAt:new Date()}});
      await audit(tx,c.userId,"Staff MFA enrolled",c.userId);return {recoveryCodes};
    }
    await consumeFactor(tx,c.user,code,config);await tx.loginThrottle.deleteMany({where:{key:{in:[`mfa-factor:${c.userId}`,`mfa-failed:${c.userId}`]}}});const session=await sessionFor(tx,c.user,config,true);await tx.authChallenge.delete({where:{tokenHash:c.tokenHash}});await audit(tx,c.userId,"Staff signed in with MFA",c.userId);return {session,user:c.user};
  });return result;
  }catch(error){if(error instanceof ApiError&&error.statusCode===401){const failed=await throttle(db,`mfa-failed:${initial.userId}`,1000,900);if(failed===3)await securityAlert(db,"MFA failures",initial.userId);}throw error;}
}
export async function completeMfa(db:Db,req:FastifyRequest,config:Config){
  const initial=await challenge(db,req,config);
  return transaction(db,async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${initial.userId} FOR UPDATE`;
    const c=await challenge(tx,req,config);assert(c.verifiedAt&&c.user.mfaSecret,409,"Verify your authenticator first");
    const session=await sessionFor(tx,c.user,config,true);await tx.authChallenge.delete({where:{tokenHash:c.tokenHash}});await audit(tx,c.userId,"Staff signed in after MFA setup",c.userId);return {session,user:c.user};
  });
}
export async function reauthenticate(db:Db,auth:Authenticated,config:Config,password:string,code:string){
  assert(auth.user.role!=="STUDENT",403,"Staff verification required");await throttle(db,`reauth:${auth.user.id}`,5,300);
  assert(await verifyPassword(password,auth.user.passwordHash),401,"Verification failed");
  return transaction(db,async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${auth.user.id} FOR UPDATE`;
    const user=await tx.user.findUniqueOrThrow({where:{id:auth.user.id},include:{student:true}});
    assert(user.enabled&&user.authVersion===auth.user.authVersion&&user.mfaVersion===auth.user.mfaVersion,401,"Sign in again");
    const session=await tx.session.findUnique({where:{tokenHash:auth.tokenHash}});assert(session&&session.expiresAt>new Date(),401,"Sign in again");
    await consumeFactor(tx,user,code,config);const until=new Date(Date.now()+300000);await tx.session.update({where:{tokenHash:auth.tokenHash},data:{reauthUntil:until}});await audit(tx,user.id,"Sensitive-action authentication renewed",user.id);return {until:until.toISOString()};
  });
}
export async function resetStaffMfa(db:Db,actor:string,userId:string,remarks:string){
  return transaction(db,async tx=>{const user=await tx.user.findUnique({where:{id:userId}});assert(user&&user.role!=="STUDENT",404,"Staff account not found");
    await tx.user.update({where:{id:userId},data:{mfaSecret:null,mfaLastCounter:-1,mfaVersion:{increment:1},authVersion:{increment:1}}});
    await tx.session.deleteMany({where:{userId}});await tx.authChallenge.deleteMany({where:{userId}});await tx.recoveryCode.deleteMany({where:{userId}});await audit(tx,actor,"Staff MFA reset; reenrollment required",userId,{remarks});await securityAlert(tx,"Staff MFA reset",userId);return {ok:true};});
}
