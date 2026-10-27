import {test,expect} from "@playwright/test";

test("mobile filters, catalog pagination and dialog focus remain usable",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/admin/questions");
  await expect(page.getByLabel("Question status",{exact:true})).toBeHidden();
  await page.getByText("Filters and sorting",{exact:true}).click();
  await expect(page.getByLabel("Question status",{exact:true})).toBeVisible();
  const preview=page.getByRole("button",{name:"Preview",exact:true}).first();
  await preview.click();await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);await expect(preview).toBeFocused();
  await page.goto("/student/mock-tests");
  await expect(page.getByRole("heading",{name:"Full Length Test 01",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Full Length Test 09",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Next page",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Full Length Test 09",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Full Length Test 01",exact:true})).toHaveCount(0);
  await expect(page.getByText("40 records / Page 2 of 5",{exact:true})).toBeVisible();
});

test("collapsed navigation scrolls on shorter screens and keeps visible tooltips",async({page})=>{
  await page.setViewportSize({width:1024,height:600});await page.goto("/admin/dashboard");
  const settings=page.locator(".desktop-sidebar").getByRole("link",{name:"Settings",exact:true});
  await settings.scrollIntoViewIfNeeded();await settings.focus();
  await expect(settings.locator(".icon")).toBeVisible();
  const tooltip=settings.getByRole("tooltip");await expect(tooltip).toBeVisible();
  const bounds=await tooltip.boundingBox();expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(600);
  await settings.click();await expect(page.getByRole("heading",{name:"Platform settings",exact:true})).toBeVisible();
});

test("mobile password controls preserve the entry and readable input size",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const role of ["student","trainer","admin"]){
    await page.goto(`/${role}/login`);const password=page.getByLabel("Password",{exact:true});
    await password.fill("Synthetic-design-check");await page.getByRole("button",{name:"Show password",exact:true}).click();
    await expect(password).toHaveAttribute("type","text");await expect(password).toHaveValue("Synthetic-design-check");
    await page.getByRole("button",{name:"Hide password",exact:true}).click();await expect(password).toHaveAttribute("type","password");
    expect(await password.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
});


test("assessment navigation does not cover the large-font Writing response",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/student/mock-tests/GENERAL/practice-mock-01/instructions");
  await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Start test",exact:true}).click();
  await page.getByRole("button",{name:"Display settings",exact:true}).click();
  await page.getByRole("combobox",{name:"Colour theme",exact:true}).selectOption("yellow");
  await page.getByRole("combobox",{name:"Font size",exact:true}).selectOption("extra-large");
  await page.getByRole("button",{name:"Writing",exact:true}).click();
  const editor=await page.getByRole("textbox",{name:"Task 1 response",exact:true}).boundingBox();
  const navigation=await page.locator(".exam-footer").boundingBox();
  expect(navigation!.y).toBeGreaterThanOrEqual(editor!.y+editor!.height);
});
