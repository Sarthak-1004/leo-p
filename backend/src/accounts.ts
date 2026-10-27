import { z } from "zod";
import { transaction, type Db } from "./db.js";
import { admin, audit, hashPassword, notify, academicSelect, type Identity } from "./auth.js";
import { assert, identifier, password, course, date } from "./domain.js";
const contact=z.object({phone:z.string().max(40),email:z.string().max(200),address:z.string().max(1000),guardianContact:z.string().max(200)}).strict();
export const studentSchema=z.object({id:identifier,name:z.string().trim().min(1).max(120),course,startDate:date,expiryDate:date,enabled:z.boolean(),trainerId:identifier.nullable().optional(),movePending:z.boolean().default(false),password:password.optional(),contacts:contact.optional()}).strict();
export const trainerSchema=z.object({id:identifier,name:z.string().trim().min(1).max(120),email:z.email().max(200),enabled:z.boolean(),password:password.optional()}).strict();
export async function saveStudent(db:Db,user:Identity,input:z.infer<typeof studentSchema>) {
  admin(user);assert(input.expiryDate>=input.startDate,400,"Expiry cannot precede the start date");
  const hash=input.password?await hashPassword(input.password):undefined;
  return transaction(db,async tx=>{
    const old=await tx.user.findUnique({where:{id:input.id},include:{student:true}});
    assert(!old||old.role==="STUDENT",409,"This ID belongs to a staff account");
    assert(old||hash,400,"Set a password for the new student");
    if(input.trainerId)assert(await tx.user.findFirst({where:{id:input.trainerId,role:"TRAINER",enabled:true}}),400,"Choose an enabled trainer");
    const accessChanged=old&&(old.enabled!==input.enabled||old.student?.course!==input.course||old.student.startDate!==input.startDate||old.student.expiryDate!==input.expiryDate||!!hash);
    await tx.user.upsert({where:{id:input.id},create:{id:input.id,name:input.name,role:"STUDENT",enabled:input.enabled,passwordHash:hash??old!.passwordHash},update:{name:input.name,enabled:input.enabled,...(hash?{passwordHash:hash}:{}),...(accessChanged?{authVersion:{increment:1}}:{})}});
    await tx.student.upsert({where:{id:input.id},create:{id:input.id,course:input.course,startDate:input.startDate,expiryDate:input.expiryDate,trainerId:input.trainerId},update:{course:input.course,startDate:input.startDate,expiryDate:input.expiryDate,trainerId:input.trainerId??null}});
    if(input.movePending){const moved=await tx.result.updateMany({where:{studentId:input.id,reviewStatus:{not:"Completed"}},data:{assignedTrainerId:input.trainerId??null,version:{increment:1}}});await audit(tx,user.id,"Pending evaluations reassigned",input.id,{trainerId:input.trainerId??null,count:moved.count});}
    if(input.contacts)await tx.studentContact.upsert({where:{studentId:input.id},create:{studentId:input.id,...input.contacts},update:input.contacts});
    await audit(tx,user.id,old?"Student updated":"Student created",input.id,{previous:old?{name:old.name,course:old.student?.course,startDate:old.student?.startDate,expiryDate:old.student?.expiryDate,enabled:old.enabled,trainerId:old.student?.trainerId}:null,current:{name:input.name,course:input.course,startDate:input.startDate,expiryDate:input.expiryDate,enabled:input.enabled,trainerId:input.trainerId},passwordReset:!!hash});
    if(input.trainerId&&input.trainerId!==old?.student?.trainerId)await notify(tx,input.trainerId,`${input.name} has been assigned to you.`,`/trainer/students/${input.id}`);
    return tx.student.findUnique({where:{id:input.id},select:{...academicSelect,contacts:true}});
  });
}
export async function saveTrainer(db:Db,user:Identity,input:z.infer<typeof trainerSchema>) {
  admin(user);const hash=input.password?await hashPassword(input.password):undefined;
  return transaction(db,async tx=>{
    const old=await tx.user.findUnique({where:{id:input.id}});
    assert(!old||old.role==="TRAINER",409,"This ID belongs to another role");assert(old||hash,400,"Set a password for the new trainer");
    const saved=await tx.user.upsert({where:{id:input.id},create:{id:input.id,role:"TRAINER",name:input.name,email:input.email.toLowerCase(),enabled:input.enabled,passwordHash:hash??old!.passwordHash},update:{name:input.name,email:input.email.toLowerCase(),enabled:input.enabled,...(hash?{passwordHash:hash}:{}),authVersion:{increment:1}},select:{id:true,name:true,email:true,enabled:true}});
    await audit(tx,user.id,old?"Trainer updated":"Trainer created",input.id,{enabled:input.enabled,passwordReset:!!hash});return saved;
  });
}
