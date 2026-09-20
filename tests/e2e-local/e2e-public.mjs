import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`); };

const browser = await chromium.launch();
const consoleErrors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error" && !/status of 404/.test(m.text())) consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

// ---- Directory
await page.goto(BASE);
await page.waitForSelector("h1");
check("home: heading present", (await page.textContent("h1")).includes("Find a GDG Noida volunteer"));
const cards = await page.locator("ul li a[href^='/volunteer/']").count();
check("home: first page shows 24 of 30 published volunteers", cards === 24, `cards=${cards}`);
check("home: unpublished and pending volunteers not listed", (await page.content()).includes("Hidden Person") === false && (await page.content()).includes("Pending Person") === false);
check("home: count text", (await page.textContent("#results-heading")).includes("30 volunteers"));
check("home: pagination present", await page.locator("nav[aria-label=Pagination]").count() === 1);
await page.screenshot({ path: "shots/home-desktop.png", fullPage: false });

// ---- Search as you type
await page.fill("#volunteer-search", "LOVE");
await page.waitForFunction(() => document.querySelector("#results-heading")?.textContent?.includes("1 volunteer"), null, { timeout: 8000 });
check("search: case-insensitive partial match finds Ada Lovelace", (await page.textContent("main")).includes("Ada Lovelace"));
check("search: URL reflects the query", page.url().includes("q=LOVE"));
await page.fill("#volunteer-search", "zzzz-no-one");
await page.waitForSelector("text=No volunteers match that search", { timeout: 8000 });
check("search: empty state shown", true);
await page.screenshot({ path: "shots/home-empty.png" });
await page.click("text=Clear search and filters");
await page.waitForFunction(() => document.querySelector("#results-heading")?.textContent?.includes("30 volunteers"), null, { timeout: 8000 });
check("search: clear link resets the results", (await page.inputValue("#volunteer-search")) === "");

// multi-word, any order
await page.fill("#volunteer-search", "lovelace ada");
await page.waitForFunction(() => document.querySelector("#results-heading")?.textContent?.includes("1 volunteer"), null, { timeout: 8000 });
check("search: multi-word in any order", true);

// Wildcard chars are literal
await page.goto(BASE + "/?q=%25");
await page.waitForSelector("text=No volunteers match that search");
check("search: '%' is treated literally, not as a wildcard", true);

// ---- Team filter
await page.goto(BASE);
await page.click("nav[aria-label='Filter by team'] >> text=Design");
await page.waitForFunction(() => location.search.includes("team=design"));
const designCount = await page.locator("ul li a[href^='/volunteer/']").count();
check("team filter: only Design members", designCount === 6, `count=${designCount}`);
check("team filter: inactive team not offered", (await page.content()).includes("Retired Crew") === false);
check("team filter: active chip is marked", await page.locator("a[aria-current='true']", { hasText: "Design" }).count() === 1);

// ---- Pagination
await page.goto(BASE + "/?page=2");
const p2 = await page.locator("ul li a[href^='/volunteer/']").count();
check("pagination: page 2 has the remaining 6", p2 === 6, `count=${p2}`);
await page.goto(BASE + "/?page=99");
await page.waitForFunction(() => location.search.includes("page=2"), null, { timeout: 8000 });
check("pagination: out-of-range page redirects to the last page", true);

// ---- Profile
await page.goto(BASE + "/volunteer/ada-lovelace");
check("profile: name", (await page.textContent("h1")).trim() === "Ada Lovelace");
check("profile: approved GitHub link shown", await page.locator("a[href='https://github.com/ada']").count() === 1);
check("profile: unapproved Instagram link NOT shown", (await page.content()).includes("hidden-ada") === false);
const ext = await page.locator("a[href='https://github.com/ada']").getAttribute("rel");
check("profile: external links use noopener noreferrer", /noopener/.test(ext) && /noreferrer/.test(ext));
await page.waitForSelector("article img");
const imgOk = await page.evaluate(() => { const i = document.querySelector("article img"); return i && i.complete && i.naturalWidth > 0; });
check("profile: photo loads through /photos/[slug]", imgOk);
check("profile: share controls", await page.locator("button", { hasText: "Copy link" }).count() === 1);
const title = await page.title();
check("profile: dynamic title", title.startsWith("Ada Lovelace"), title);
const robots = await page.locator("meta[name=robots]").getAttribute("content");
check("profile: noindex by default", /noindex/.test(robots ?? ""), robots);
await page.screenshot({ path: "shots/profile-desktop.png", fullPage: true });

// ---- Not public
for (const slug of ["hidden-person", "pending-person", "does-not-exist", "Bad_Slug!"]) {
  const r = await page.goto(BASE + "/volunteer/" + encodeURIComponent(slug));
  check(`profile: ${slug} -> 404 with neutral text`, r.status() === 404 && (await page.textContent("h1")).includes("not available"), `status=${r.status()}`);
}

// ---- Photos route
const good = await ctx.request.get(BASE + "/photos/ada-lovelace");
check("photo route: published volunteer's photo served as an image", good.status() === 200 && (good.headers()["content-type"] ?? "").startsWith("image/"), `status=${good.status()}`);
check("photo route: nosniff + cache header", good.headers()["x-content-type-options"] === "nosniff" && /max-age=300/.test(good.headers()["cache-control"] ?? ""));
const hidden = await ctx.request.get(BASE + "/photos/hidden-person");
check("photo route: unpublished volunteer's photo is NOT served", hidden.status() === 404, `status=${hidden.status()}`);
const noPhoto = await ctx.request.get(BASE + "/photos/grace-hopper");
check("photo route: volunteer without a photo -> 404", noPhoto.status() === 404);
const evil = await ctx.request.get(BASE + "/photos/..%2F..%2Fetc");
check("photo route: junk slug -> 404", evil.status() === 404);

// ---- Privacy + misc
await page.goto(BASE + "/privacy");
check("privacy: draft banner + configured contact", (await page.textContent("main")).includes("Draft for review") && (await page.textContent("main")).includes("volunteers@example.org"));
const robotsTxt = await (await ctx.request.get(BASE + "/robots.txt")).text();
check("robots.txt disallows everything by default", /Disallow: \//.test(robotsTxt));
const headers = (await ctx.request.get(BASE + "/")).headers();
check("security headers present", !!headers["content-security-policy"] && headers["x-frame-options"] === "DENY" && headers["x-content-type-options"] === "nosniff");
check("no cookies set by public pages", (await ctx.cookies()).length === 0);
const admin = await ctx.request.get(BASE + "/admin", { maxRedirects: 0 });
check("admin: signed-out visit is redirected to login", admin.status() >= 300 && admin.status() < 400 && (admin.headers()["location"] ?? "").includes("/admin/login"), `${admin.status()} ${admin.headers()["location"]}`);
const qrApi = await ctx.request.get(BASE + "/api/admin/qr/svg");
check("admin QR API: 401 when signed out", qrApi.status() === 401, `status=${qrApi.status()}`);

// ---- Mobile
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const m = await mobile.newPage();
await m.goto(BASE);
await m.waitForSelector("#results-heading");
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check("mobile: no horizontal overflow on the directory", !overflow);
await m.screenshot({ path: "shots/home-mobile.png" });
await m.goto(BASE + "/volunteer/ada-lovelace");
await m.waitForSelector("h1");
check("mobile: no horizontal overflow on a profile", !(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
await m.screenshot({ path: "shots/profile-mobile.png", fullPage: true });

check("no browser console errors on public pages", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
