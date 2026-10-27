import { saveTestRecord, testSchema } from "./content.js";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { json, transaction, type Db, type Tx } from "./db.js";
import { admin, audit, notify, type Identity } from "./auth.js";
import { assert, questionSchema } from "./domain.js";
function testInput(data:Record<string,string>){return testSchema.parse({id:data.id,course:data.course,kind:data.kind,number:Number(data.number),version:Number(data.version),published:false,available:false,duration:150,builder:{questionIds:JSON.parse(data.questionIds??"{}"),duration:JSON.parse(data.durations??"{}")}});}
type Row = {row:number;data:Record<string,string>;error:string};
export function csvExport(rows:string[][]) { return "\uFEFF"+rows.map(row=>row.map(v=>`"${(/^[=+@\-\t\r]/.test(v)?"'":"")+v.replaceAll('"','""')}"`).join(",")).join("\r\n"); }
function safeZip(buffer:Buffer) {
  let eocd=-1;
  for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65558);i--) if(buffer.readUInt32LE(i)===0x06054b50){eocd=i;break;}
  assert(eocd>=0,400,"Invalid XLSX archive");
  const count=buffer.readUInt16LE(eocd+10);let offset=buffer.readUInt32LE(eocd+16),size=0;
  assert(count<=2000,400,"Workbook contains too many files");
  for(let i=0;i<count;i++) {
    assert(offset+46<=buffer.length&&buffer.readUInt32LE(offset)===0x02014b50,400,"Invalid XLSX directory");
    size+=buffer.readUInt32LE(offset+24);
    assert(size<=25*1024*1024,400,"Workbook expands beyond the 25 MB limit");
    offset+=46+buffer.readUInt16LE(offset+28)+buffer.readUInt16LE(offset+30)+buffer.readUInt16LE(offset+32);
  }
}
export async function parseImport(buffer:Buffer,filename:string):Promise<Record<string,string>[]> {
  assert(buffer.length<=5*1024*1024,400,"Import files must be under 5 MB");
  let rows:string[][];
  if(filename.toLowerCase().endsWith(".csv")) rows=parse(buffer.toString("utf8").replace(/^\uFEFF/,""),{bom:true,skip_empty_lines:true,max_record_size:100000,columns:false,relax_column_count:false});
  else {
    assert(filename.toLowerCase().endsWith(".xlsx"),400,"Choose a CSV or XLSX file");safeZip(buffer);
    const book=new ExcelJS.Workbook();await book.xlsx.load(buffer as any);
    const sheet=book.worksheets[0];assert(sheet,400,"Workbook has no worksheet");
    assert(sheet.rowCount<=1001&&sheet.columnCount<=30,400,"Import supports up to 1000 rows and 30 columns");
    rows=[];sheet.eachRow(row=>{const values:string[]=[];row.eachCell({includeEmpty:true},cell=>{assert(cell.type!==ExcelJS.ValueType.Formula,400,"Use plain values, not spreadsheet formulas");values.push(cell.text);});rows.push(values);});
  }
  assert(rows.length>1&&rows.length<=1001,400,"Supply between 1 and 1000 data rows");
  const header=rows[0]!.map(s=>s.trim());assert(new Set(header).size===header.length&&header.every(Boolean)&&!header.some(s=>["__proto__","constructor","prototype"].includes(s)),400,"Headers must be unique, non-empty field names");
  return rows.slice(1).map(values=>Object.fromEntries(header.map((key,i)=>[key,values[i]?.trim()??""])));
}
async function validate(tx:Db|Tx,kind:string,rows:Row[],user:Identity) {
  const students=kind==="assignments"?await tx.student.findMany({select:{id:true,course:true,trainerId:true}}):[];
  const trainers=kind==="assignments"?await tx.user.findMany({where:{role:"TRAINER",enabled:true},select:{id:true}}):[];
  return Promise.all(rows.map(async row=>{
    let error="";
    try {
      if(kind==="assignments") {
        const student=students.find(s=>s.id===row.data["Student ID"]),trainer=trainers.find(t=>t.id===(row.data["Teacher ID"]??row.data["Trainer ID"]));
        assert(student,400,"Student ID not found");assert(trainer,400,"Enabled Teacher ID not found");
        assert(!row.data["Move Pending"]||["true","false"].includes(row.data["Move Pending"]),400,"Move Pending must be true or false");
        assert(student.course===row.data.Course,400,"Course does not match student");
        assert(student.trainerId!==trainer.id,400,"Student is already assigned to this trainer");
        assert(rows.filter(r=>r.data["Student ID"]===student.id).length===1,400,"Duplicate Student ID");
      } else if(kind === "tests") {
        const input=testInput(row.data);
        assert(rows.filter(r=>r.data.id===input.id&&r.data.course===input.course).length===1,400,"Duplicate test identifier");
        await saveTestRecord(tx,user,input,true);
      } else {
        const q=questionSchema.parse({...row.data,options:JSON.parse(row.data.options??"[]"),answer:JSON.parse(row.data.answer??'""'),assetIds:JSON.parse(row.data.assetIds??"[]"),published:false,archived:false,practiceEligible:row.data.practiceEligible!=="false",version:undefined});
        assert(await tx.asset.count({where:{id:{in:q.assetIds}}})===q.assetIds.length,400,"An asset ID does not exist");
        assert(!await tx.question.findUnique({where:{id:q.id}}),400,"Question ID already exists");
        assert(rows.filter(r=>r.data.id===q.id).length===1,400,"Duplicate Question ID");
      }
    }catch(e){error=e instanceof z.ZodError?e.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; "):e instanceof Error?e.message:"Invalid row";}
    return {...row,error};
  }));
}
export async function previewImport(db:Db,user:Identity,kind:string,buffer:Buffer,filename:string) {
  admin(user);assert(["assignments","questions","tests"].includes(kind),400,"Unsupported import type");
  const data=await parseImport(buffer,filename);
  const rows=await validate(db,kind,data.map((data,i)=>({row:i+2,data,error:""})),user);
  const batch=await db.importBatch.create({data:{actorId:user.id,kind,rows:json(rows)}});
  if(rows.some(r=>r.error))await notify(db,user.id,`Import validation: ${rows.filter(r=>r.error).length} rows need correction.`,kind==="assignments"?"/admin/trainers":"/admin/imports");
  return {id:batch.id,rows,valid:rows.filter(r=>!r.error).length,failed:rows.filter(r=>r.error).length};
}
export async function confirmImport(db:Db,user:Identity,id:string) {
  admin(user);
  return transaction(db,async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "ImportBatch" WHERE "id"=${id} FOR UPDATE`;
    const batch=await tx.importBatch.findUnique({where:{id}});assert(batch&&batch.actorId===user.id,404,"Import not found");
    if(batch.committedAt)return {rows:batch.rows,alreadyCommitted:true};
    const rows=await validate(tx,batch.kind,batch.rows as unknown as Row[],user);
    for(const row of rows.filter(r=>!r.error)) {
      if(batch.kind==="assignments") {
        const trainerId=row.data["Teacher ID"]??row.data["Trainer ID"]!;
        const studentId=row.data["Student ID"]!;
        const previous=await tx.student.findUniqueOrThrow({where:{id:studentId},select:{trainerId:true}});
        await tx.student.update({where:{id:studentId},data:{trainerId}});
        if(row.data["Move Pending"]==="true")await tx.result.updateMany({where:{studentId,reviewStatus:{not:"Completed"}},data:{assignedTrainerId:trainerId,version:{increment:1}}});
        await audit(tx,user.id,"Student assigned",studentId,{previousTrainer:previous.trainerId,trainerId,movePending:row.data["Move Pending"]==="true",importId:id});
        await notify(tx,trainerId,"A student has been assigned to you.","/trainer/students");
      } else if(batch.kind === "tests") {
        await saveTestRecord(tx,user,testInput(row.data));
      } else {
        const input=questionSchema.parse({...row.data,options:JSON.parse(row.data.options??"[]"),answer:JSON.parse(row.data.answer??'""'),assetIds:JSON.parse(row.data.assetIds??"[]"),published:false,archived:false,practiceEligible:row.data.practiceEligible!=="false",version:undefined});
        const {version,...q}=input;await tx.question.create({data:{...q,answer:json(q.answer)}});
      }
    }
    await tx.importBatch.update({where:{id},data:{rows:json(rows),committedAt:new Date()}});
    await audit(tx,user.id,"Import confirmed",id,{kind:batch.kind,success:rows.filter(r=>!r.error).length,failed:rows.filter(r=>r.error).length});
    return {rows,success:rows.filter(r=>!r.error).length,failed:rows.filter(r=>r.error).length};
  });
}
