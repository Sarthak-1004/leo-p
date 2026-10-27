import type {Db,Tx} from "./db.js";
import {defaultSettings,settingsSchema} from "./domain.js";
export async function platformSettings(db:Db|Tx){
  const saved=await db.platformSetting.findUnique({where:{id:"platform"}});
  return settingsSchema.parse({...defaultSettings,...saved?.value as object});
}
export async function institution(db:Db){
  const {institutionName,supportEmail,supportPhone,supportAddress}=await platformSettings(db);
  return {institutionName,supportEmail,supportPhone,supportAddress};
}
