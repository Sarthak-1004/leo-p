import {expect,type Page} from "@playwright/test";
export async function login(page:Page,role:"student"|"trainer"|"admin",identifier:string=role,password="E2e-fixture-password-only"){
  await page.goto(`/${role}/login`);
  await page.getByLabel(role==="admin"?"Admin ID or email":role==="trainer"?"Trainer ID or email":"Student ID or email",{exact:true}).fill(identifier);
  await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`));await expect(page.locator("#main-content h1")).toBeVisible();
}
