import {readFileSync,writeFileSync} from "node:fs";
import {expect,type Page} from "@playwright/test";
import {createRequire} from "node:module";
const {TOTP,Secret}=createRequire(new URL("../../backend/package.json",import.meta.url))("otpauth");
export const authenticatorCode=(secret:string)=>new TOTP({secret:Secret.fromBase32(secret)}).generate();
export function fixtureRecoveryCode(role:string){const file=new URL("../../backend/.local/e2e-mfa.json",import.meta.url),codes=JSON.parse(readFileSync(file,"utf8")) as Record<string,string[]>;const code=codes[role]?.shift();if(!code)throw new Error("No isolated MFA fixture code available");writeFileSync(file,JSON.stringify(codes));return code;}
export async function login(page:Page,role:"student"|"trainer"|"admin"){
  await page.goto(`/${role}/login`);await page.getByLabel(role==="admin"?"Admin ID":role==="trainer"?"Trainer ID or email":"Student ID",{exact:true}).fill(role);
  await page.getByLabel("Password",{exact:true}).fill("E2e-fixture-password-only");await page.getByRole("button",{name:"Sign in",exact:true}).click();
  if(role!=="student"){await page.getByRole("textbox",{name:"Authenticator or recovery code",exact:true}).fill(fixtureRecoveryCode(role));await page.getByRole("button",{name:"Verify and continue",exact:true}).click();}
  await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`));await expect(page.locator("#main-content h1")).toBeVisible();
}
