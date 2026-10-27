import { test, expect, type Page } from "@playwright/test";

import { rawToBand, roundBand, writingBand, speakingBand, overallBand } from "../src/utils/scoring";

const spa = (page: Page, path: string) => page.evaluate(path => { history.pushState({}, "", path); window.dispatchEvent(new PopStateEvent("popstate")); }, path);

async function start(page: Page, testId = "practice-mock-01") {

  await page.goto(`/student/mock-tests/GENERAL/${testId}/instructions`);

  await page.getByRole("checkbox").check();

  await page.getByRole("button", { name: "Start test", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Section 1: Listening" })).toBeVisible();

}

async function submit(page: Page) {

  await page.getByRole("button", { name: "Writing", exact: true }).click();

  await page.getByRole("button", { name: "Submit test", exact: true }).click();

  await page.getByRole("button", { name: "Confirm submission" }).click();

  await expect(page.getByRole("heading", { name: "Attempt submitted in preview" })).toBeVisible();

}

const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);



test("SOW band thresholds and missing lower conversions", () => {

  expect([6.125,6.25,6.375,6.75,3.875].map(roundBand)).toEqual([6,6.5,6.5,7,4]);

  expect(writingBand(6,6.5)).toBe(6.5);

  expect(speakingBand({ fluency: 6, lexical: 6, grammar: 7, pronunciation: 7 })).toBe(6.5);

  expect(overallBand({ listening: 6.5, reading: 6, writing: 6, speaking: null })).toBe(6);

  expect(overallBand({ listening: 6.5, reading: 6, writing: 6, speaking: 7 })).toBe(6.5);

  expect(rawToBand(30,"Reading","GENERAL")).toBe(6);

  expect(rawToBand(30,"Reading","ACADEMIC")).toBe(7);

  expect(rawToBand(9,"Listening","GENERAL")).toBeNull();

  expect(rawToBand(8,"Reading","GENERAL")).toBeNull();

  expect(() => speakingBand({ fluency: 6.5, lexical: 6, grammar: 7, pronunciation: 7 })).toThrow();

});

test("Speaking routes are offline and practice records enter history", async ({ page }) => {

  await page.goto("/student/practice/speaking/sample");

  await expect(page.getByRole("heading", { name: "Speaking is conducted offline by your trainer." })).toBeVisible();

  await expect(page.getByRole("button", { name: /record/i })).toHaveCount(0);

  await spa(page, "/student/practice/listening/sample");

  await page.getByRole("combobox", { name: "Playback speed", exact: true }).selectOption("2");

  await page.getByRole("radio").first().check();

  await page.getByRole("button", { name: "Submit practice", exact: true }).click();

  await page.getByRole("button", { name: "Close review" }).click();

  await page.getByRole("button", { name: "New practice attempt" }).click();

  await expect(page.getByRole("combobox", { name: "Playback speed", exact: true })).toHaveValue("1");

  await spa(page,"/student/history");

  await expect(page.getByRole("heading", { name: "Listening practice", exact: true })).toBeVisible();

});

test("practice mocks consume two starts, resume same attempt, and keep display preferences", async ({ page }) => {

  await start(page);

  await expect(page.getByRole("combobox", { name: "Playback speed", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Display settings" }).click();

  await page.getByRole("combobox", { name: "Colour theme", exact: true }).selectOption("dark");

  await page.getByRole("combobox", { name: "Font size", exact: true }).selectOption("large");

  const first = page.url();

  await spa(page,"/student/practice-mocks");

  await page.getByRole("link", { name: "Resume test", exact: true }).click();

  expect(page.url()).toBe(first);

  await page.getByRole("button", { name: "Display settings" }).click();

  await expect(page.getByRole("combobox", { name: "Colour theme", exact: true })).toHaveValue("dark");

  await expect(page.getByRole("combobox", { name: "Font size", exact: true })).toHaveValue("large");

  await submit(page);

  await spa(page,"/student/practice-mocks");

  await page.getByRole("link", { name: "Start second attempt" }).click();

  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Start test", exact: true }).click();

  expect(page.url()).not.toBe(first);

  await submit(page); await spa(page,"/student/practice-mocks");

  await expect(page.getByText("Attempts used (2/2)", {exact: true})).toBeVisible();

  await expect(page.getByRole("link", { name: /Start.*attempt|Start test/ })).toHaveCount(0);

});

test("FLT completed fixture cannot restart and wrong course is blocked", async ({ page }) => {

  await page.goto("/student/mock-tests/GENERAL/mock-01/instructions");

  await expect(page.getByRole("button", { name: "Attempts used", exact: true })).toBeDisabled();

  await page.goto("/student/mock-tests/ACADEMIC/mock-03/instructions");

  await expect(page.getByRole("heading", { name: "Test unavailable" })).toBeVisible();

  await page.goto("/student/results/general-06");

  await expect(page.getByRole("heading", { name: "Result not released yet" })).toBeVisible();

});

test("score remarks, isolated draft, release, and offline Speaking recalculation", async ({ page }) => {

  await page.goto("/trainer/evaluations/general-06");

  await page.getByLabel("Writing", {exact: true}).fill("6.5");

  await page.getByRole("button",{name:"Complete review",exact:true}).click();

  await expect(page.getByRole("alert")).toContainText("Add remarks");

  await page.getByLabel("Reason for changes").fill("Manual review confirms the Writing band.");

  await page.getByRole("button",{name:"Save draft",exact:true}).click();

  await expect(page.getByText("Draft saved in this preview. Approved scores remain unchanged.")).toBeVisible();

  await spa(page,"/admin/results/general-06");

  await expect(page.getByRole("button",{name:"Release result",exact:true})).toBeDisabled();

  await page.getByRole("button",{name:"Complete review",exact:true}).click();

  await page.getByRole("button",{name:"Release result",exact:true}).click();

  await spa(page,"/student/results/general-06");

  await expect(page.getByRole("heading",{name:/Overall \(3 skills\).*Speaking pending/})).toBeVisible();

  await spa(page,"/trainer/evaluations/general-06");

  await page.getByLabel("Offline Speaking date").fill("2026-10-27");

  for (const label of ["Fluency and Coherence","Lexical Resource","Grammatical Range and Accuracy","Pronunciation"]) await page.getByRole("combobox",{name:label,exact:true}).selectOption("7");

  await page.getByLabel("Reason for changes").fill("Offline Speaking assessed today.");

  await page.getByRole("button",{name:"Complete review",exact:true}).click();

  await spa(page,"/student/results/general-06");

  await expect(page.getByRole("heading",{name:"Overall (4 skills)",exact:true})).toBeVisible();

  await spa(page,"/student/notifications");

  await expect(page.getByRole("link",{name:/Your Speaking score has been added/})).toBeVisible();

});

test("trainer all-student access and validated CSV assignment", async ({ page }) => {

  await page.goto("/trainer/students");

  await page.getByRole("button",{name:"All students",exact:true}).click();

  await expect(page.getByRole("heading",{name:"Arjan Singh",exact:true})).toBeVisible();

  await expect(page.getByLabel("Password",{exact:true})).toHaveCount(0);

  await spa(page,"/admin/trainers");

  await page.getByLabel("Assignment CSV",{exact:true}).setInputFiles({name:"assign.csv",mimeType:"text/csv",buffer:Buffer.from("Student ID,Teacher ID,Course\nKAN-88440,TR-001,ACADEMIC\nUNKNOWN,TR-001,GENERAL\n")});

  await expect(page.getByText("1 valid",{exact:true})).toBeVisible();

  await expect(page.getByText("Student ID not found",{exact:true})).toBeVisible();

  await page.getByRole("button",{name:"Confirm 1 assignments"}).click();

  await expect(page.getByText("1 assignments applied to this preview. 1 rows were not imported.")).toBeVisible();

});

for (const width of [1440,1280,1024,768,430,390]) test(`responsive pages and all test display combinations at ${width}px`, async ({ page }) => {

  test.setTimeout(60000);

  await page.setViewportSize({width,height:1000});

  for (const path of ["/student/dashboard","/student/practice","/student/history","/admin/dashboard","/admin/trainers","/trainer/dashboard","/trainer/students","/trainer/evaluations","/admin/questions","/admin/mock-tests","/admin/mock-tests/GENERAL/mock-03/builder","/admin/settings","/student/results/general-02","/student/profile","/trainer/profile"]) {

    await page.goto(path); await expect(page.locator("#main-content h1").first()).toBeVisible(); await noOverflow(page);

  }

  if(width < 768) {

    await page.getByRole("button",{name:"Open navigation",exact:true}).click();

    await expect(page.getByRole("dialog",{name:"Navigation menu"})).toBeVisible();

    await page.getByRole("button",{name:"Close navigation",exact:true}).click();

  } else {

    const toggle=page.getByRole("button",{name:"Collapse sidebar",exact:true});

    if(await toggle.isVisible()) await toggle.click();

    await expect(page.locator(".desktop-sidebar .nav-item.active .icon")).toBeVisible();

  }

  await start(page); await page.getByRole("button",{name:"Display settings"}).click();

  for(const theme of ["standard","dark","yellow"]) for(const size of ["standard","large","extra-large"]) {

    await page.getByRole("combobox",{name:"Colour theme",exact:true}).selectOption(theme); await page.getByRole("combobox",{name:"Font size",exact:true}).selectOption(size);

    for(const section of ["Listening","Reading","Writing"]) {

      await page.getByRole("button",{name:section,exact:true}).click(); await noOverflow(page);

    }

  }

  if(width === 390 || width === 1440) await page.screenshot({path:`test-results/exam-${width}.png`,fullPage:true});

});


test("course availability is independent and Practice Mocks have no unlock", async ({ page }) => {
  await page.goto("/admin/mock-tests");
  const general = page.getByRole("switch", { name: "Availability for GENERAL Mock 3", exact: true });
  await expect(general).toHaveAttribute("aria-checked", "true");
  await general.click();
  await page.getByRole("button", { name: "ACADEMIC", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Availability for ACADEMIC Mock 3", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Practice Mock Tests", exact: true }).click();
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /1 Practice Mock Tests/ })).toBeVisible();
});

test("interruption signals stop preview time and fourth stop flags review", async ({ page }) => {
  await start(page, "mock-03");
  const timer = page.getByLabel("Preview remaining time", { exact: true });
  for(let count=1; count<=4; count++) {
    await page.context().setOffline(true);
    await expect(page.getByText("Connection interrupted. The preview timer has stopped.")).toBeVisible();
    if(count===1) {
      const remaining=await timer.textContent();
      await page.waitForTimeout(1100);
      await expect(timer).toHaveText(remaining!);
    }
    await page.context().setOffline(false);
    await expect(page.getByText("Connection interrupted. The preview timer has stopped.")).toHaveCount(0);
  }
  await expect(page.getByRole("status").filter({hasText:"4 interruptions"})).toBeVisible();
  await spa(page,"/admin/audit");
  await expect(page.getByText("Attempt flagged for review", {exact:true})).toBeVisible();
});
