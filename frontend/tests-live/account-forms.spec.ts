import {test,expect} from "@playwright/test";
import {login} from "./auth";

for (const role of ["student", "trainer"] as const) {
  test(`${role} creation displays server validation inside the dialog and saves after correction`, async ({page}) => {
    await login(page,"admin");
    await page.goto(`/admin/${role}s`);
    await page.getByRole("button",{name:`Add ${role}`,exact:true}).click();
    const dialog=page.getByRole("dialog");
    const id=`FORM-${role.toUpperCase()}`;
    await dialog.getByLabel(role==="student"?"Student ID":"Trainer ID",{exact:true}).fill(id);
    await dialog.getByLabel("Name",{exact:true}).fill(`Form ${role}`);
    if(role==="trainer")await dialog.getByLabel("Email",{exact:true}).fill("form-trainer@example.test");
    await dialog.getByLabel("Initial password",{exact:true}).fill("aaaaaaaaaaaa");
    const rejected=page.waitForResponse(r=>r.url().endsWith(`/api/admin/${role}s/${id}`)&&r.request().method()==="PUT");
    await dialog.getByRole("button",{name:`Save ${role}`,exact:true}).click();
    expect((await rejected).status()).toBe(400);
    await expect(dialog.getByRole("alert")).toContainText("Use at least 6 different characters");
    for(const width of [1440,1280,1024,768,430,390]){
      await page.setViewportSize({width,height:1000});
      await dialog.getByRole("alert").scrollIntoViewIfNeeded();
      await expect(dialog.getByRole("alert")).toBeInViewport();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
    await expect(dialog.getByLabel("Name",{exact:true})).toHaveValue(`Form ${role}`);
    await dialog.getByLabel("Initial password",{exact:true}).fill("Orchid-River-739!");
    let release:()=>void=()=>{};
    const held=new Promise<void>(resolve=>{release=resolve;});
    await page.route(`**/api/admin/${role}s/${id}`,async route=>{
      await held;
      await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Service temporarily unavailable. Try again."})});
    },{times:1});
    try{
      await dialog.getByRole("button",{name:`Save ${role}`,exact:true}).click();
      await expect(dialog.getByRole("button",{name:/Saving/})).toBeDisabled();
    }finally{release();}
    await expect(dialog.getByRole("alert")).toContainText("Service temporarily unavailable");
    await expect(dialog.getByLabel("Name",{exact:true})).toHaveValue(`Form ${role}`);
    await dialog.getByRole("button",{name:`Save ${role}`,exact:true}).click();
    if(role==="student")await dialog.getByRole("button",{name:"Done",exact:true}).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    const response=await page.request.get("/api/bootstrap");
    const accounts=(await response.json())[`${role}s`] as {id:string;name:string}[];
    expect(accounts.filter(account=>account.id===id)).toEqual([expect.objectContaining({name:`Form ${role}`})]);
  });
}
