import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "./generated/prisma/client.js";
export { Prisma };
export type Db = PrismaClient;
export type Tx = Prisma.TransactionClient;
export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export function database(url: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 12 }) });
}
export function retryableTransactionError(error:unknown):boolean {
  const seen=new Set<unknown>();
  function conflict(value:unknown,depth:number):boolean {
    if(!value||typeof value!=="object"||depth>6||seen.has(value))return false;
    seen.add(value);const e=value as Record<string,unknown>;
    // Raw SELECT ... FOR UPDATE errors can be P2010 with the SQLSTATE nested
    // in adapter metadata, while ORM writes normally report P2034.
    if(["P2034","40001","40P01"].includes(String(e.code))||["40001","40P01"].includes(String(e.originalCode))||e.kind==="TransactionWriteConflict")return true;
    return [e.meta,e.cause,e.driverAdapterError].some(nested=>conflict(nested,depth+1));
  }
  return conflict(error,0);
}
export async function transaction<T>(db: Db, action: (tx: Tx) => Promise<T>): Promise<T> {
  for (let tries = 0; ; tries++) {
    try { return await db.$transaction(action, { isolationLevel: "Serializable", timeout: 20000 }); }
    catch (error) {
      if (tries < 6 && retryableTransactionError(error)) {await new Promise(resolve=>setTimeout(resolve,10*2**tries+Math.floor(Math.random()*15)));continue;}
      throw error;
    }
  }
}
