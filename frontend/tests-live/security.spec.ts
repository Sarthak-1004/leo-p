import {test,expect} from "@playwright/test";
import {login} from "./auth";
for(const [role,email] of [["admin","admin@example.test"],["trainer","teacher@example.test"],["student","student-private@example.test"]] as const){
  test(`${role} signs in with either email or ID and password without an authenticator`,async({browser})=>{
    for(const identifier of [role,email.toUpperCase()]){
      const context=await browser.newContext(),page=await context.newPage();
      try{
        const response=page.waitForResponse(r=>r.url().endsWith("/api/auth/login")&&r.request().method()==="POST");
        await login(page,role,identifier);const result=await (await response).json();
        expect(result.user.id).toBe(role);expect(result.mfaRequired).toBeUndefined();
        await page.reload();await expect(page.locator("#main-content h1")).toBeVisible();
        await expect(page.getByText(/authenticator|recovery codes|two-step sign-in/i)).toHaveCount(0);
      }finally{await context.close();}
    }
  });
}
test("all login pages show only email or ID and password at all six widths",async({page})=>{
  for(const role of ["admin","trainer","student"]){
    await page.goto(`/${role}/login`);
    for(const width of [1440,1280,1024,768,430,390]){
      await page.setViewportSize({width,height:1000});
      await expect(page.locator(".auth-form form input")).toHaveCount(2);
      await expect(page.getByRole("textbox",{name:/ID or email/})).toBeVisible();
      await expect(page.getByLabel("Password",{exact:true})).toBeVisible();
      await expect(page.getByText(/authenticator|recovery codes|two-step sign-in/i)).toHaveCount(0);
      await expect(page.getByRole("link",{name:/sign up|register|forgot password/i})).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
  }
});
test("sensitive-action confirmation retries the original change after password verification only",async({page})=>{
  await login(page,"admin");await page.goto("/admin/settings");
  await page.getByRole("textbox",{name:"Platform name",exact:true}).fill("Verified password fixture");
  let challenged=false;
  await page.route("**/api/admin/settings",async route=>{
    if(route.request().method()==="PUT"&&!challenged){challenged=true;await route.fulfill({status:403,contentType:"application/json",body:JSON.stringify({message:"Recent verification required",code:"REAUTH_REQUIRED"})});return;}
    await route.continue();
  });
  await page.getByRole("button",{name:"Save settings",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Confirm this sensitive action",exact:true});await expect(dialog).toBeVisible();
  for(const width of [1440,1280,1024,768,430,390]){
    await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await expect(dialog.locator("input")).toHaveCount(1);
  await dialog.getByLabel("Password",{exact:true}).fill("E2e-fixture-password-only");
  await dialog.getByRole("button",{name:"Verify action",exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(page.getByText("Settings saved.",{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole("textbox",{name:"Platform name",exact:true})).toHaveValue("Verified password fixture");
});
