import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import type { Db } from "./db.js";
import type { Config } from "./config.js";
import { admin, audit, type Identity } from "./auth.js";
import { assert } from "./domain.js";
import {platformSettings} from "./settings.js";
export class Storage {
  private client:S3Client;
  constructor(private config:Config) { this.client=new S3Client({region:config.S3_REGION,endpoint:config.S3_ENDPOINT,forcePathStyle:!!config.S3_ENDPOINT,credentials:config.S3_ACCESS_KEY_ID&&config.S3_SECRET_ACCESS_KEY?{accessKeyId:config.S3_ACCESS_KEY_ID,secretAccessKey:config.S3_SECRET_ACCESS_KEY}:undefined}); }
  private bucket(){assert(this.config.S3_BUCKET,503,"File storage is not configured");return this.config.S3_BUCKET;}
  close(){this.client.destroy();}
  // Internal worker access only; never exposed as a student URL or public bucket object.
  async evaluationImages(db:Db,ids:string[]){
    const unique=[...new Set(ids)];assert(unique.length<=10,400,"Too many task images");
    const assets=await db.asset.findMany({where:{id:{in:unique}}});assert(assets.length===unique.length,400,"A task image is unavailable");
    assert(assets.every(a=>["image/png","image/jpeg","image/webp"].includes(a.contentType)),400,"Writing evaluation accepts task images only");
    assert(assets.reduce((sum,a)=>sum+a.size,0)<=20*1024*1024,400,"Task images exceed the 20 MB evaluation limit");
    const output=[];let total=0;
    for(const id of unique){const asset=assets.find(a=>a.id===id)!;const object=await this.client.send(new GetObjectCommand({Bucket:this.bucket(),Key:asset.key}));assert(object.Body,503,"A task image is unavailable");assert((object.ContentLength??asset.size)+total<=20*1024*1024,400,"Task images exceed the evaluation limit");const bytes=await object.Body.transformToByteArray();total+=bytes.length;assert(total<=20*1024*1024,400,"Task images exceed the evaluation limit");output.push({id,imageUrl:`data:${asset.contentType};base64,${Buffer.from(bytes).toString("base64")}`});}
    return output;
  }
  async upload(db:Db,user:Identity,filename:string,body:Buffer) {
    admin(user);const limit=(await platformSettings(db)).mediaLimitMb;assert(body.length>0&&body.length<=limit*1024*1024,400,`Choose media up to ${limit} MB`);
    let contentType="";
    if(body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))contentType="image/png";
    else if(body[0]===255&&body[1]===216&&body[2]===255)contentType="image/jpeg";
    else if(body.toString("ascii",0,4)==="RIFF"&&body.toString("ascii",8,12)==="WEBP")contentType="image/webp";
    else if(body.toString("ascii",0,3)==="ID3"||(body[0]===255&&(body[1]!&0xe0)===0xe0))contentType="audio/mpeg";
    else if(body.toString("ascii",0,4)==="RIFF"&&body.toString("ascii",8,12)==="WAVE")contentType="audio/wav";
    assert(contentType,400,"Use PNG, JPEG, WebP, MP3 or WAV files");
    const key=`assessment/${randomUUID()}`;
    await this.client.send(new PutObjectCommand({Bucket:this.bucket(),Key:key,Body:body,ContentType:contentType}));
    const asset=await db.asset.create({data:{key,filename:filename.replace(/[\r\n\\/]/g,"_").slice(0,200),contentType,size:body.length,uploadedBy:user.id}});
    await audit(db,user.id,"Media uploaded",asset.id,{contentType,size:body.length});
    return {id:asset.id,filename:asset.filename,contentType,size:body.length};
  }
  async readUrl(db:Db,user:Identity,id:string) {
    const asset=await db.asset.findUnique({where:{id}});assert(asset,404,"Media not found");
    if(user.role === "STUDENT") {
      const practice=await db.question.findFirst({where:{assetIds:{has:id},course:{in:[user.student!.course,"BOTH"]},published:true,archived:false,practiceEligible:true,skill:{not:"Speaking"}},select:{id:true}});
      const attempts=practice?[]:await db.attempt.findMany({where:{studentId:user.id,course:user.student!.course},select:{snapshot:true,state:true,id:true,result:{select:{released:true,kind:true}}}});
      assert(practice||attempts.some(a=>{const eligible=a.state==="IN_PROGRESS"||a.result?.released||a.result?.kind!=="FLT";return eligible&&(a.snapshot as any).questions?.some((q:any)=>q.skill!=="Speaking"&&q.assetIds?.includes(id));}),404,"Media not found");
    }
    await this.client.send(new HeadObjectCommand({Bucket:this.bucket(),Key:asset.key}));
    return {url:await getSignedUrl(this.client,new GetObjectCommand({Bucket:this.bucket(),Key:asset.key}),{expiresIn:120}),expiresIn:120,contentType:asset.contentType};
  }
  async stream(db:Db,user:Identity,id:string,range?:string) {
    await this.readUrl(db,user,id);
    const asset=await db.asset.findUniqueOrThrow({where:{id}});
    assert(!range||/^bytes=\d*-\d*$/.test(range),400,"Invalid media range");
    return this.client.send(new GetObjectCommand({Bucket:this.bucket(),Key:asset.key,Range:range}));
  }
}
