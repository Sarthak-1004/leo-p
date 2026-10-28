import {database} from "../src/db.js";
import {resetStaffMfa} from "../src/mfa.js";
const args=process.argv.slice(2),value=(flag:string)=>args[args.indexOf(flag)+1];
if(!args.includes("--user")||!args.includes("--remarks")||!args.includes("--confirm-reenrollment"))throw new Error("Required: --user ID --remarks REASON --confirm-reenrollment. This revokes staff sessions and requires new MFA enrollment.");
const id=value("--user"),remarks=value("--remarks");if(!id||!remarks||remarks.length<10)throw new Error("Supply a staff ID and meaningful recovery remarks");
if(!process.env.DATABASE_URL)throw new Error("Set the authorized database connection through the environment");
const db=database(process.env.DATABASE_URL);
try{await resetStaffMfa(db,"deployment-operator",id,remarks);console.log("MFA reset recorded. All affected sessions and recovery codes were revoked; the staff member must enroll again.");}finally{await db.$disconnect();}
