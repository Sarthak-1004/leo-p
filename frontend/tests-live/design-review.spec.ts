import {test,expect} from "@playwright/test";
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";

test("connected staff screens remain readable across six widths",async({page})=>{
  test.setTimeout(180000);
  await page.goto("/admin/login");await page.getByLabel("Admin ID",{exact:true}).fill("admin");await page.getByLabel("Password",{exact:true}).fill("E2e-fixture-password-only");await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/admin\/dashboard$/);
  const folder=resolve("../tmp/design-audit/live");await mkdir(folder,{recursive:true});
  const paths=["/admin/reports","/admin/settings","/admin/imports","/admin/media","/admin/operations","/admin/audit","/admin/notifications","/admin/mock-tests/GENERAL/mock-01/builder"];
  for(const width of [1440,1280,1024,768,430,390]){
    await page.setViewportSize({width,height:1000});
    for(const path of paths){
      await page.goto(path);await expect(page.locator("#main-content h1")).toBeVisible();await page.waitForLoadState("networkidle");
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} at ${width}`).toBeTruthy();
      if(width===390||width===1440)await page.screenshot({path:resolve(folder,`${width}-${path.slice(1).replaceAll("/","__")}.png`),fullPage:true});
    }
  }
  await page.goto("/admin/reports");await expect(page.getByLabel("Course",{exact:true})).toBeHidden();await page.getByText("Report filters",{exact:true}).click();await expect(page.getByLabel("Course",{exact:true})).toBeVisible();
});
