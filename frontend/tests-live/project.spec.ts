import {test,expect,type Page} from "@playwright/test";
async function login(page:Page,role:"student"|"trainer"|"admin"){
  await page.goto(`/${role}/login`);
  await page.getByLabel(role==="admin"?"Admin ID":role==="trainer"?"Trainer ID or email":"Student ID",{exact:true}).fill(role);
  await page.getByLabel("Password",{exact:true}).fill("E2e-fixture-password-only");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`));
  await expect(page.locator("#main-content h1")).toBeVisible();
}
test("real login protects role routes and retains the session after reload",async({page})=>{
  await page.goto("/admin/dashboard");await expect(page).toHaveURL(/\/admin\/login$/);
  await login(page,"admin");await page.reload();await expect(page.getByRole("heading",{name:"Operations & academic dashboard"})).toBeVisible();
  await expect(page.getByLabel("Preview course")).toHaveCount(0);
  await page.goto("/trainer/students");await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.getByRole("link",{name:"Sign out",exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});
test("Admin creates a persistent student with credentials and contacts",async({page})=>{
  await login(page,"admin");await page.getByRole("link",{name:"Students",exact:true}).click();
  await page.getByRole("button",{name:"Add student",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Student ID",{exact:true}).fill("NEW-STUDENT");await dialog.getByLabel("Name",{exact:true}).fill("New Student");
  await dialog.getByLabel("Initial password",{exact:true}).fill("New-student-password-123");
  await dialog.getByLabel("Phone",{exact:true}).fill("private-new-contact");
  await dialog.getByLabel("Start date",{exact:true}).fill("2020-01-01");await dialog.getByLabel("Expiry date",{exact:true}).fill("2099-01-01");
  await dialog.getByRole("button",{name:"Save student",exact:true}).click();await dialog.getByRole("button",{name:"Done",exact:true}).click();
  await page.reload();await expect(page.locator(".desktop-table").getByText("New Student",{exact:true})).toBeVisible();
});
test("saved FLT answers survive reload, then Trainer review and Admin release reveal result",async({browser})=>{
  test.setTimeout(120000);
  const studentContext=await browser.newContext(),student=await studentContext.newPage();await login(student,"student");
  await student.getByRole("link",{name:"Full Length Tests",exact:true}).first().click();
  await student.getByRole("link",{name:"Start test",exact:true}).click();await student.getByRole("checkbox").check();await student.getByRole("button",{name:"Start test",exact:true}).click();
  await expect(student.getByRole("heading",{name:"Full Length Test 01",exact:true})).toBeVisible();
  await student.getByRole("button",{name:"Display settings",exact:true}).click();
  for(const width of [1440,1280,1024,768,430,390]){
    await student.setViewportSize({width,height:1000});
    for(const theme of ["standard","dark","yellow"])for(const size of ["standard","large","extra-large"]){
      await student.getByRole("combobox",{name:"Colour theme",exact:true}).selectOption(theme);
      await student.getByRole("combobox",{name:"Font size",exact:true}).selectOption(size);
      expect(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
  }
  await student.screenshot({path:"test-results/live-exam-mobile.png"});
  await student.setViewportSize({width:1440,height:1000});
  let lostAcknowledgment=false;
  await student.route("**/api/attempts/*/heartbeat",async route=>{
    const input=route.request().postDataJSON();
    if(!lostAcknowledgment&&Object.keys(input.answers??{}).length){lostAcknowledgment=true;await route.fetch();await route.abort("failed");return;}
    await route.continue();
  });
  await student.getByRole("radio",{name:"yes",exact:true}).first().check();await student.getByRole("button",{name:"Save answers",exact:true}).click();
  await expect.poll(()=>lostAcknowledgment).toBe(true);
  await student.getByRole("radio",{name:"yes",exact:true}).nth(1).check();
  await expect(student.getByText("Saved on server",{exact:true})).toBeVisible({timeout:12000});await student.reload();await expect(student.getByRole("radio",{name:"yes",exact:true}).first()).toBeChecked();
  await expect(student.getByRole("radio",{name:"yes",exact:true}).nth(1)).toBeChecked();
  await student.getByRole("button",{name:"Display settings",exact:true}).click();
  await expect(student.getByRole("combobox",{name:"Colour theme",exact:true})).toHaveValue("yellow");
  await expect(student.getByRole("combobox",{name:"Font size",exact:true})).toHaveValue("extra-large");
  const attemptId=student.url().split("/").at(-1)!;
  await student.getByRole("button",{name:"Writing",exact:true}).click();await student.getByLabel("Task 1 response",{exact:true}).fill("Dear Manager, I am writing to suggest improvements to our local bus services.");
  await student.getByRole("button",{name:"Submit test",exact:true}).click();await student.getByRole("button",{name:"Confirm submission",exact:true}).click();
  await expect(student.getByRole("heading",{name:"Test submitted",exact:true})).toBeVisible();
  await student.goto(`/student/results/${attemptId}`);await expect(student.getByRole("heading",{name:"Result not released yet",exact:true})).toBeVisible();
  const trainerContext=await browser.newContext(),trainer=await trainerContext.newPage();await login(trainer,"trainer");
  const response=await trainer.request.get("/api/bootstrap");expect(await response.text()).not.toContain("private-new-contact");expect(await response.text()).not.toContain("555-secret-contact");
  await trainer.goto(`/trainer/evaluations/${attemptId}`);await trainer.getByLabel("Listening",{exact:true}).fill("7");await trainer.getByLabel("Reading",{exact:true}).fill("7");await trainer.getByLabel("Writing",{exact:true}).fill("6.5");await trainer.getByLabel("Reason for changes").fill("Manual review confirms these section scores.");await trainer.getByRole("button",{name:"Complete review",exact:true}).click();
  await expect(trainer.getByText("Review completed.")).toBeVisible();
  const adminContext=await browser.newContext(),admin=await adminContext.newPage();await login(admin,"admin");await admin.goto(`/admin/results/${attemptId}`);await admin.getByRole("button",{name:"Release result",exact:true}).click();
  await expect(admin.getByText("Result released. Student notification sent.")).toBeVisible();
  await student.reload();await expect(student.getByRole("heading",{name:/Overall \(3 skills\).*Speaking pending/})).toBeVisible();
  await studentContext.close();await trainerContext.close();await adminContext.close();
});


test("Admin settings, announcements, reports and operational screens work across required widths",async({page})=>{
 test.setTimeout(120000);await login(page,"admin");
 await page.goto("/admin/settings");await page.getByLabel("Support email",{exact:true}).fill("office@example.test");await page.getByLabel("Default access duration (days)",{exact:true}).fill("90");await page.getByRole("button",{name:"Save settings",exact:true}).click();await expect(page.getByText("Settings saved.",{exact:true})).toBeVisible();await page.reload();await expect(page.getByLabel("Support email",{exact:true})).toHaveValue("office@example.test");
 await page.goto("/admin/notifications");await expect(page.getByRole("link",{name:"Local operations notification",exact:true})).toBeVisible();
 await page.getByLabel("Announcement",{exact:true}).fill("Fixture announcement for General students");await page.getByLabel("Course",{exact:true}).selectOption("GENERAL");await page.getByRole("button",{name:"Review announcement",exact:true}).click();await page.getByRole("button",{name:"Send announcement",exact:true}).click();await expect(page.getByText(/Announcement sent to/)).toBeVisible();
 for(const width of [1440,1280,1024,768,430,390]){
  await page.setViewportSize({width,height:1000});for(const path of ["/admin/reports","/admin/settings","/admin/notifications","/admin/operations","/admin/audit","/admin/media"]){await page.goto(path);await expect(page.locator("#main-content h1")).toBeVisible();if(path==="/admin/reports")await expect(page.getByRole("heading",{name:"Submitted assessments",exact:false})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${path} at ${width}`).toBe(true);}
 }
 await page.screenshot({path:"test-results/live-operations-mobile.png"});
 await page.setViewportSize({width:1440,height:1000});await page.goto("/admin/reports");await page.getByLabel("Course",{exact:true}).selectOption("GENERAL");await page.getByRole("button",{name:"Apply filters",exact:true}).click();await expect(page.getByRole("heading",{name:/Submitted assessments/})).toBeVisible();
 const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Export CSV",exact:true}).click();expect((await downloadPromise).suggestedFilename()).toBe("academic-report.csv");
});

test("Reading passage navigation and submitted sections persist across reload",async({page})=>{
 await login(page,"student");await page.goto("/student/practice-mocks");await page.getByRole("link",{name:"Start test",exact:true}).click();await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Start test",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Practice Mock Test 01",exact:true})).toBeVisible();await page.getByRole("radio",{name:"yes",exact:true}).first().check();await page.getByRole("button",{name:"Submit Listening section",exact:true}).click();await page.getByRole("button",{name:"Confirm section submission",exact:true}).click();
 await expect(page.getByRole("button",{name:"Submit Reading section",exact:true})).toBeVisible();await page.getByRole("button",{name:"Passage 2",exact:true}).click();await expect(page.getByText("Passage 2: isolated reading fixture for automated checks.",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Save answers",exact:true}).click();await expect(page.getByText("Saved on server",{exact:true})).toBeVisible();await page.reload();await expect(page.getByText("Passage 2: isolated reading fixture for automated checks.",{exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Listening",exact:true})).toBeDisabled();
});

test("Writing module submission has a dedicated staff review and no offline Speaking form",async({browser})=>{
 const studentContext=await browser.newContext(),student=await studentContext.newPage();await login(student,"student");await student.goto("/student/practice/writing/sample");await student.getByLabel("Question type",{exact:true}).selectOption("Task 2");await student.getByRole("button",{name:"Start practice",exact:true}).click();await expect(student.getByLabel("Task 2 response",{exact:true})).toBeVisible();await student.getByLabel("Task 2 response",{exact:true}).fill("Transport investment helps communities reach work and education.");const id=student.url().split("/").at(-1)!;
 await student.getByRole("button",{name:"Submit test",exact:true}).click();await student.getByRole("button",{name:"Confirm submission",exact:true}).click();await expect(student.getByRole("heading",{name:"Test submitted",exact:true})).toBeVisible();
 const trainerContext=await browser.newContext(),trainer=await trainerContext.newPage();await login(trainer,"trainer");await trainer.goto(`/trainer/evaluations/${id}`);await expect(trainer.getByRole("heading",{name:"Offline Speaking",exact:true})).toHaveCount(0);await expect(trainer.getByLabel("Listening",{exact:true})).toHaveCount(0);await trainer.getByLabel("Writing",{exact:true}).fill("6.5");await trainer.getByLabel("Reason for changes",{exact:true}).fill("Module-only Writing review");await trainer.getByRole("button",{name:"Complete review",exact:true}).click();await expect(trainer.getByText("Review completed.",{exact:true})).toBeVisible();
 await student.goto(`/student/results/${id}/details`);await expect(student.getByRole("heading",{name:"Writing",exact:true})).toBeVisible();await expect(student.getByText("6.5",{exact:false}).first()).toBeVisible();await studentContext.close();await trainerContext.close();
});


test("Admin can save an existing test structure without sending reporting metadata as mutation fields",async({page})=>{
 await login(page,"admin");await page.goto("/admin/mock-tests");await page.getByRole("button",{name:"Add Practice Mock Test",exact:true}).click();await page.getByRole("dialog").getByLabel("Test number",{exact:true}).fill("42");await page.getByRole("button",{name:"Create draft",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
 await page.goto("/admin/mock-tests/GENERAL/practice-mock-42/builder");await expect(page.getByRole("heading",{name:"Practice Mock Test 42 builder",exact:true})).toBeVisible();await page.getByRole("button",{name:"Apply draft",exact:true}).click();await expect(page.getByText("Test structure saved.",{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole("heading",{name:"Practice Mock Test 42 builder",exact:true})).toBeVisible();
});

test("a late anonymous session response cannot undo a successful sign-in",async({page})=>{
 let initial:import("@playwright/test").Route|undefined;
 await page.route("**/api/auth/me",route=>{initial=route;},{times:1});
 await login(page,"student");expect(initial).toBeDefined();await initial!.fulfill({status:401,contentType:"application/json",body:JSON.stringify({message:"No initial session"})});
 await expect(page).toHaveURL(/student\/dashboard$/);await expect(page.locator("#main-content h1")).toBeVisible();await page.reload();await expect(page.locator("#main-content h1")).toBeVisible();await expect(page).toHaveURL(/student\/dashboard$/);
});
