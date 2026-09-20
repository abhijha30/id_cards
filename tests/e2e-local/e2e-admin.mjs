import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { PNG } from "pngjs";

const BASE = "http://localhost:3000";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`); };
const until = async (fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 150)); } return false; };
const sql = (q) => execFileSync("psql", ["-At", "-d", "gdg_e2e", "-c", q]).toString().trim();

// fixtures for uploads
const png = new PNG({ width: 400, height: 500 });
for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 30; png.data[i + 1] = 140; png.data[i + 2] = 220; png.data[i + 3] = 255; }
fs.writeFileSync("photo.png", PNG.sync.write(png));
fs.writeFileSync("fake.png", "<?php system($_GET['c']); ?>");
const big = Buffer.alloc(6 * 1024 * 1024); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(big); fs.writeFileSync("big.png", big);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error" && !/status of (40[0-9])/.test(m.text())) consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

async function login(email, password) {
  await page.goto(BASE + "/admin/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button:has-text('Sign in')");
}

// ---------- Authentication
await login("plain@example.test", "plain-user-pass");
await page.locator("[role=alert]", { hasText: "not an administrator" }).waitFor();
check("login: a signed-in non-admin is refused", true);
check("login: non-admin gets no admin session (still on login page)", page.url().includes("/admin/login"));
await page.goto(BASE + "/admin");
check("login: non-admin cannot open /admin", page.url().includes("/admin/login"));

await login("admin@example.test", "wrong-password");
await page.locator("[role=alert]", { hasText: "incorrect" }).waitFor();
check("login: wrong password shows a generic error", true);

await login("admin@example.test", "correct-horse-battery");
await page.waitForURL(BASE + "/admin");
check("login: administrator reaches the dashboard", (await page.textContent("h1")).includes("Overview"));
const stats = await page.locator("ul li a span.font-display").allTextContents();
check("dashboard: counts (total 32, published 30, not published 2, consent missing 1, teams 6)", stats.join(",") === "32,30,2,1,6", stats.join(","));
await page.screenshot({ path: "shots/admin-dashboard.png" });

// ---------- Volunteers list
await page.goto(BASE + "/admin/volunteers?status=draft");
check("list: 'not published' filter shows the 2 unpublished profiles", await page.locator("ul.space-y-3 > li").count() === 2);
await page.goto(BASE + "/admin/volunteers?q=pending");
await page.locator("li:has-text('Pending Person') button:has-text('Publish')").click();
await page.locator("[role=alert]", { hasText: "Record consent" }).waitFor();
check("list: publishing without consent is blocked with an explanation", true);
check("list: ...and the profile stays unpublished in the database", sql("select is_published from volunteers where slug='pending-person'") === "f");
await page.screenshot({ path: "shots/admin-list.png", fullPage: true });

// ---------- Create
await page.goto(BASE + "/admin/volunteers/new");
await page.fill("#full_name", "Test Volunteer");
await page.fill("#public_role", "Stage crew");
await page.selectOption("#team_id", { label: "Design" });
await page.fill("#bio", "Line one.\nLine two.");
await page.fill("#skills", "Lighting, Sound, lighting");
await page.fill("#social_github_url", "javascript:alert(1)");
await page.click("button:has-text('Create volunteer')");
await page.waitForSelector("#social_github_url-error");
check("create: a javascript: link is rejected with a field error", (await page.textContent("#social_github_url-error")).length > 0);
check("create: typed values survive a failed submit", (await page.inputValue("#full_name")) === "Test Volunteer" && (await page.inputValue("#bio")).includes("Line two"));
check("create: the chosen team survives a failed submit", (await page.locator("#team_id option:checked").textContent()) === "Design");
check("create: nothing was saved", sql("select count(*) from volunteers where full_name='Test Volunteer'") === "0");

await page.fill("#social_github_url", "https://github.com/test-volunteer");
await page.check("input[name=social_github_approved]");
await page.fill("#social_instagram_url", "https://www.instagram.com/secret-test");
await page.click("button:has-text('Create volunteer')");
await page.waitForURL(/\/admin\/volunteers\/[0-9a-f-]{36}\/edit\?notice=created/);
const vid = page.url().match(/volunteers\/([0-9a-f-]{36})\/edit/)[1];
check("create: redirected to the edit screen with a success notice", (await page.textContent("[role=status]")).includes("Volunteer created"));
check("create: slug generated from the name", sql(`select slug from volunteers where id='${vid}'`) === "test-volunteer");
check("create: team saved as Design", sql(`select t.name from volunteers v join teams t on t.id=v.team_id where v.id='${vid}'`) === "Design");
check("create: skills cleaned and de-duplicated", sql(`select array_to_string(skills, '|') from volunteers where id='${vid}'`) === "Lighting|Sound");
check("create: new profile starts unpublished with consent pending", sql(`select is_published::text||'/'||consent_status from volunteers where id='${vid}'`) === "false/pending");

// duplicate name -> unique slug
await page.goto(BASE + "/admin/volunteers/new");
await page.fill("#full_name", "Test Volunteer");
await page.click("button:has-text('Create volunteer')");
await page.waitForURL(/\/edit\?notice=created/);
check("create: a duplicate name gets a unique slug (-2)", sql("select string_agg(slug, ',' order by slug) from volunteers where full_name='Test Volunteer'") === "test-volunteer,test-volunteer-2");
const dupId = page.url().match(/volunteers\/([0-9a-f-]{36})\/edit/)[1];

// ---------- Photo upload
await page.goto(`${BASE}/admin/volunteers/${vid}/edit`);
await page.setInputFiles("input[type=file]", "fake.png");
await page.locator("[role=alert]", { hasText: "not a JPEG, PNG or WebP" }).waitFor();
check("upload: a renamed non-image is rejected in the browser", true);
await page.setInputFiles("input[type=file]", "big.png");
await page.locator("[role=alert]", { hasText: "maximum is 5 MB" }).waitFor();
check("upload: files over 5 MB are rejected with a clear message", true);

await page.setInputFiles("input[type=file]", "photo.png");
await page.waitForSelector("button:has-text('Upload photo')");
check("upload: preview appears before uploading", await page.locator("img[alt^='Preview of new photo']").count() === 1);
await page.click("button:has-text('Upload photo')");
await page.waitForSelector("text=Photo saved.", { timeout: 15000 });
check("upload: success message", true);
const path1 = sql(`select photo_path from volunteers where id='${vid}'`);
check("upload: photo_path saved in the volunteer's own folder", new RegExp(`^${vid}/[0-9a-f-]{36}\\.png$`).test(path1), path1);
check("upload: object exists in storage", sql(`select count(*) from storage.objects where name='${path1}'`) === "1");
await page.waitForSelector("img[alt^='Current photo']");
const shown = await page.waitForFunction(() => { const i = document.querySelector("img[alt^='Current photo']"); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).then(() => true, () => false);
check("upload: the saved photo displays via a signed URL", shown);
await page.screenshot({ path: "shots/admin-edit.png", fullPage: true });

// replace
await page.setInputFiles("input[type=file]", "photo.png");
await page.click("button:has-text('Replace photo')");
await page.waitForFunction((old) => !document.body.textContent.includes("Uploading") && document.body.textContent.includes("Photo saved."), path1, { timeout: 15000 });
const path2 = sql(`select photo_path from volunteers where id='${vid}'`);
check("replace: photo_path changed", path2 !== path1);
check("replace: the old file was removed, only one object remains", sql(`select count(*) from storage.objects where name like '${vid}/%'`) === "1");

// ---------- Publish flow
await page.selectOption("#consent_status", "granted");
await page.check("input[name=is_published]");
await page.click("button:has-text('Save changes')");
await page.waitForSelector("text=Changes saved.");
check("publish: selects keep their value after a successful save", (await page.locator("#consent_status option:checked").textContent()) === "Granted" && (await page.locator("#team_id option:checked").textContent()) === "Design");
check("publish: consent + publish saved", sql(`select is_published::text||'/'||consent_status||'/'||(consent_recorded_at is not null)::text||'/'||consent_version from volunteers where id='${vid}'`) === "true/granted/true/2026-09-draft-1");
const pub = await ctx.request.get(BASE + "/volunteer/test-volunteer");
check("publish: profile is now public", pub.status() === 200);
check("publish: photo is now served publicly", (await ctx.request.get(BASE + "/photos/test-volunteer")).status() === 200);
const pubHtml = await pub.text();
check("publish: approved link shown, unapproved link absent from public HTML", pubHtml.includes("github.com/test-volunteer") && !pubHtml.includes("secret-test"));

// withdraw consent while the publish box is still ticked -> must go private
await page.selectOption("#consent_status", "withdrawn");
await page.click("button:has-text('Save changes')");
await page.waitForSelector("text=saved as unpublished");
check("withdraw: profile is forced back to unpublished", sql(`select is_published::text from volunteers where id='${vid}'`) === "false");
check("withdraw: public profile now 404", (await ctx.request.get(BASE + "/volunteer/test-volunteer")).status() === 404);
check("withdraw: public photo now 404", (await ctx.request.get(BASE + "/photos/test-volunteer")).status() === 404);

// list toggle
await page.selectOption("#consent_status", "granted");
await page.click("button:has-text('Save changes')");
check("list prep: consent granted again", await until(() => sql(`select consent_status from volunteers where id='${vid}'`) === "granted"));
await page.goto(BASE + "/admin/volunteers?q=Test");
await page.locator("li:has-text('Test Volunteer') >> nth=0").locator("button:has-text('Publish')").click();
await page.waitForSelector("text=Profile published");
check("list: publish button works once consent is granted", sql("select count(*) from volunteers where full_name='Test Volunteer' and is_published") === "1");
await page.locator("li:has-text('Test Volunteer') button:has-text('Unpublish')").click();
await page.waitForSelector("text=Profile unpublished");
check("list: unpublish button works", sql("select count(*) from volunteers where full_name='Test Volunteer' and is_published") === "0");

// ---------- Remove photo
await page.goto(`${BASE}/admin/volunteers/${vid}/edit`);
await page.click("button:has-text('Remove photo')");
await page.click("button:has-text('Yes, remove')");
await page.waitForSelector("text=Photo removed.");
check("remove photo: column cleared and object deleted", sql(`select coalesce(photo_path,'none') from volunteers where id='${vid}'`) === "none" && sql(`select count(*) from storage.objects where name like '${vid}/%'`) === "0");

// ---------- Delete (with confirmation dialog)
await page.goto(`${BASE}/admin/volunteers/${dupId}/edit`);
await page.click("section[aria-labelledby=danger-heading] button:has-text('Delete volunteer')");
await page.waitForSelector("dialog[open]");
await page.click("dialog[open] button:has-text('Cancel')");
check("delete: cancelling keeps the record", sql(`select count(*) from volunteers where id='${dupId}'`) === "1");
await page.click("section[aria-labelledby=danger-heading] button:has-text('Delete volunteer')");
await page.click("dialog[open] button:has-text('Delete volunteer')");
await page.waitForURL(/\/admin\/volunteers\?notice=deleted/);
check("delete: confirming removes the record", sql(`select count(*) from volunteers where id='${dupId}'`) === "0");

// ---------- Teams
await page.goto(BASE + "/admin/teams");
await page.fill("#name-new", "Photography");
await page.click("button:has-text('Add team')");
await page.waitForSelector("text=created");
check("teams: create", sql("select slug from teams where name='Photography'") === "photography");
await page.fill("#name-new", "photography");
await page.click("button:has-text('Add team')");
await page.waitForSelector("#name-new-error");
check("teams: duplicate name (any case) is refused", (await page.textContent("#name-new-error")).includes("already uses"));
await page.locator("li:has-text('Photography') summary").click();
await page.locator("li:has-text('Photography') input[name=name]").fill("Photo and Video");
await page.locator("li:has-text('Photography') button:has-text('Save team')").click();
await page.waitForSelector("text=Team saved.");
check("teams: rename keeps the slug stable", sql("select name||'/'||slug from teams where slug='photography'") === "Photo and Video/photography");
await page.locator("li:has-text('Design') summary").click();
await page.locator("li:has-text('Design') button:has-text('Delete team')").first().click();
await page.locator("dialog[open] button:has-text('Delete team')").click();
await page.locator("[role=alert]", { hasText: "still has volunteers" }).waitFor();
check("teams: a team with volunteers cannot be deleted", true);
await page.locator("li:has-text('Photo and Video') summary").click();
await page.locator("li:has-text('Photo and Video') button:has-text('Delete team')").first().click();
await page.locator("dialog[open] button:has-text('Delete team')").click();
await page.waitForSelector("text=Team deleted.");
check("teams: an empty team can be deleted", sql("select count(*) from teams where slug='photography'") === "0");
await page.screenshot({ path: "shots/admin-teams.png", fullPage: true });

// ---------- QR
await page.goto(BASE + "/admin/qr");
check("qr: shows the exact configured URL", (await page.textContent("main")).includes("https://directory.example.org"));
check("qr: no warnings for a clean https URL", await page.locator("text=Do not print ID cards yet").count() === 0);
const svg = await ctx.request.get(BASE + "/api/admin/qr/svg");
check("qr: SVG download", svg.status() === 200 && (svg.headers()["content-type"] ?? "").startsWith("image/svg+xml") && /attachment/.test(svg.headers()["content-disposition"] ?? ""));
const pngRes = await ctx.request.get(BASE + "/api/admin/qr/png");
const body = await pngRes.body();
check("qr: PNG download", pngRes.status() === 200 && body.subarray(1, 4).toString() === "PNG");
fs.writeFileSync("downloaded-qr.png", body);
check("qr: unknown format -> 404", (await ctx.request.get(BASE + "/api/admin/qr/gif")).status() === 404);
await page.screenshot({ path: "shots/admin-qr.png", fullPage: true });

// ---------- Sign out
await page.click("button:has-text('Sign out')");
await page.waitForURL(/\/admin\/login/);
await page.goto(BASE + "/admin/volunteers");
check("sign out: admin pages require sign-in again", page.url().includes("/admin/login"));
check("sign out: QR API is closed again", (await ctx.request.get(BASE + "/api/admin/qr/svg")).status() === 401);

check("no unexpected browser console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
