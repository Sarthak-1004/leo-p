import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "./generated/prisma/client.js";
export { Prisma };
export type Db = PrismaClient;
export type Tx = Prisma.TransactionClient;
export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export function database(url: string) {
  // DATABASE_POOL_SIZE must stay below the database plan's connection limit (minus migrations/backups).
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: Number(process.env.DATABASE_POOL_SIZE) || 20 }) });
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
// For operations whose first statement locks the row they change (SELECT ... FOR UPDATE).
// Under Serializable, a transaction that waited for that lock fails once it is released
// ("could not serialize access"), forcing retries; Read Committed sees the committed row instead.
export const lockedTransaction = <T>(db: Db, action: (tx: Tx) => Promise<T>) => transaction(db, action, "ReadCommitted");
// Serializable by default. Callers that already serialize on a row lock (SELECT ... FOR UPDATE)
// may pass ReadCommitted to avoid false predicate conflicts under bursts such as an exam start.
export async function transaction<T>(db: Db, action: (tx: Tx) => Promise<T>, isolationLevel: "Serializable" | "ReadCommitted" = "Serializable"): Promise<T> {
  for (let tries = 0; ; tries++) {
    // maxWait: during an exam-start burst many transactions wait for a pooled connection; Prisma's 2 s default failed them.
    try { return await db.$transaction(action, { isolationLevel, timeout: 20000, maxWait: 15000 }); }
    catch (error) {
      if (tries < 6 && retryableTransactionError(error)) {await new Promise(resolve=>setTimeout(resolve,10*2**tries+Math.floor(Math.random()*15)));continue;}
      throw error;
    }
  }
}
