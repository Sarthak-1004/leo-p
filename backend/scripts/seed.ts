import { database, json } from "../src/db.js";
import { hashPassword } from "../src/auth.js";
import { defaultConversions, defaultSettings, password, identifier } from "../src/domain.js";
const url=process.env.DATABASE_URL;if(!url)throw new Error("Set DATABASE_URL before seeding");
const db=database(url);
try {
  for(const course of ["GENERAL","ACADEMIC"] as const) for(let number=1;number<=40;number++) {
    const id=`mock-${String(number).padStart(2,"0")}`;
    await db.test.upsert({where:{course_id:{course,id}},update:{},create:{id,course,kind:"FLT",number,title:`Full Length Test ${String(number).padStart(2,"0")}`,builder:{questionIds:{Listening:[],Reading:[],Writing:[],Speaking:[]},duration:{Listening:30,Reading:60,Writing:60,Speaking:0}},conversions:json(defaultConversions)}});
  }
  await db.platformSetting.upsert({where:{id:"platform"},create:{id:"platform",value:defaultSettings},update:{}});
  if(await db.user.count({where:{role:"ADMIN"}})===0) {
    const id=identifier.parse(process.env.BOOTSTRAP_ADMIN_ID??"admin");
    const secret=password.parse(process.env.BOOTSTRAP_ADMIN_PASSWORD);
    await db.user.create({data:{id,role:"ADMIN",name:process.env.BOOTSTRAP_ADMIN_NAME??"Kanan Admin",passwordHash:await hashPassword(secret)}});
    console.log(`Admin ${id} created. Passwords are never printed or stored in plaintext.`);
  }
  console.log("Catalog seeded: 40 General and 40 Academic draft FLTs. No demo students or mock results were inserted.");
}finally{await db.$disconnect();}
