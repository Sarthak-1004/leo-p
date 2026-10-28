import {test,expect} from "@playwright/test";
import {login,fixtureRecoveryCode,authenticatorCode} from "./auth";

test("staff authenticator enrollment and recovery acknowledgement fit all six widths",async({browser})=>{
  const owner=await browser.newContext(),admin=await owner.newPage();await login(admin,"admin");const session=(await (await admin.request.get("/api/auth/me")).json());
  const created=await admin.request.put("/api/admin/trainers/UI-MFA-STAFF",{headers:{"x-csrf-token":session.csrfToken,origin:"http://127.0.0.1:4174"},data:{id:"UI-MFA-STAFF",name:"MFA UI fixture",email:"mfa-ui-staff@example.test",enabled:true,password:"Synthetic-MFA-UI-password"}});expect(created.status()).toBe(200);
  const context=await browser.newContext(),page=await context.newPage();await page.goto("/trainer/login");await page.getByLabel("Trainer ID or email",{exact:true}).fill("UI-MFA-STAFF");await page.getByLabel("Password",{exact:true}).fill("Synthetic-MFA-UI-password");await page.getByRole("button",{name:"Sign in",exact:true}).click();
  const setup=page.getByRole("textbox",{name:"Authenticator setup key",exact:true});await expect(setup).toBeVisible();const seed=await setup.inputValue();
  expect((await page.request.get("/api/bootstrap")).status()).toBe(401);
  for(const width of [1440,1280,1024,768,430,390]){await page.setViewportSize({width,height:1000});await expect(page.getByRole("img",{name:"Authenticator app setup QR code"})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
  await page.getByRole("textbox",{name:"Authenticator or recovery code",exact:true}).fill(authenticatorCode(seed));await page.getByRole("button",{name:"Verify and continue",exact:true}).click();await expect(page.getByRole("heading",{name:"Save your recovery codes",exact:true})).toBeVisible();await expect(page.locator("code")).toHaveCount(10);
  expect((await page.request.get("/api/bootstrap")).status()).toBe(401);
  for(const width of [1440,1280,1024,768,430,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
  await page.getByRole("checkbox",{name:"I saved my recovery codes",exact:true}).check();await page.getByRole("button",{name:"Continue to portal",exact:true}).click();await expect(page).toHaveURL(/trainer\/dashboard$/);await page.reload();await expect(page.locator("#main-content h1")).toBeVisible();await context.close();await owner.close();
});

test("sensitive-action verification retries the original mutation after real password and MFA proof",async({page})=>{
  await login(page,"admin");await page.goto("/admin/settings");await page.getByRole("textbox",{name:"Platform name",exact:true}).fill("Verified security fixture");
  let challenged=false;await page.route("**/api/admin/settings",async route=>{if(route.request().method()==="PUT"&&!challenged){challenged=true;await route.fulfill({status:403,contentType:"application/json",body:JSON.stringify({message:"Recent verification required",code:"REAUTH_REQUIRED"})});return;}await route.continue();});
  await page.getByRole("button",{name:"Save settings",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Confirm this sensitive action",exact:true});await expect(dialog).toBeVisible();
  for(const width of [1440,1280,1024,768,430,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
  await dialog.getByLabel("Password",{exact:true}).fill("E2e-fixture-password-only");await dialog.getByRole("textbox",{name:"Authenticator or recovery code",exact:true}).fill(fixtureRecoveryCode("admin"));await dialog.getByRole("button",{name:"Verify action",exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByText("Settings saved.",{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole("textbox",{name:"Platform name",exact:true})).toHaveValue("Verified security fixture");
});
