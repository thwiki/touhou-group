import fetch from "node-fetch";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { markdownTable } from "markdown-table";
import nunjucks from "nunjucks";
import { DateTime } from "luxon";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import del from "del";
import makeDir from "make-dir";
import cpy from "cpy";
import download from "download";
import less from "less";
import { minify } from "csso";
import { Result } from "./types/mw";

interface Page {
	index: number;
	title: string;
	count: number;
	content: string;
	hash: string;
	md: string;
}

interface ImageUrl {
	from: string;
	to: string;
}

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window as any);

DOMPurify.addHook("uponSanitizeElement", function (node, _, config: createDOMPurify.Config & { IMAGE_URLS: ImageUrl[] }) {
	if (node?.nodeName === "A" && node?.hasAttribute("href")) {
		const img = node.querySelector("img");
		let href = node.getAttribute("href") ?? "";
		if (href.startsWith("/")) href = "https://thwiki.cc" + href;

		if (img?.hasAttribute("src")) {
			const imgSrc = img.getAttribute("src") ?? "";
			const extension = path.extname(imgSrc);

			if (imgSrc.startsWith(IMAGE_HOST) && /^\.(jpe?g|png|gif|webp|svg)$/.test(extension)) {
				const localSrc = "/" + IMAGES_ROOT + "/" + crypto.createHash("sha1").update(imgSrc).digest("base64url") + extension;
				node.textContent = `[![${img.getAttribute("title") ?? ""}](${localSrc})](${href})`;
				config.IMAGE_URLS.push({ from: imgSrc, to: localSrc });
			} else {
				node.textContent = `[![](/logo.png)](${href})`;
			}
		} else {
			node.textContent = `[${node.textContent}](${href})`;
		}
	} else if (node?.nodeName === "SPAN" && node.classList.contains("inside")) {
		const s = window.document.createElement("s");
		s.innerHTML = node.innerHTML;
		node.innerHTML = s.outerHTML;
	}
});

const SOURCE_URL =
	"https://thwiki.cc/api.php?action=parse&format=json&page=%E4%B8%9C%E6%96%B9%E7%9B%B8%E5%85%B3QQ%E7%BE%A4%E7%BB%84%E5%88%97%E8%A1%A8&prop=text%7Crevid%7Climitreportdata";
const IMAGE_HOST = "https://upload.thwiki.cc/";
const SITE_ROOT = "public";
const SOURCE_ROOT = "src";
const STATIC_ROOT = SOURCE_ROOT + "/static";
const PAGES_ROOT = "pages";
const IMAGES_ROOT = "images";
const LIB_ROOT = "lib";

const IMAGE_URLS: ImageUrl[] = [];

function getHash(text: string) {
	return crypto.createHash("sha1").update(text).digest("hex").substring(0, 8);
}

function htmlToMarkdown(html: string) {
	const config = { ALLOWED_TAGS: ["b", "s", "i", "img", "br"], IMAGE_URLS: [] };
	const text = DOMPurify.sanitize(html, config).replace(/\s+/g, " ");
	IMAGE_URLS.push(...config.IMAGE_URLS);
	return text;
}

function buildHome(options: { text: string; pages: Page[] }) {
	return nunjucks.render(SOURCE_ROOT + "/home.md.njk", options);
}

function buildSidebar(options: { pages: Page[] }) {
	return nunjucks.render(SOURCE_ROOT + "/_sidebar.md.njk", options);
}

function buildFooter(options: { revid: number; title: string; editDate: string; buildDate: string }) {
	return nunjucks.render(SOURCE_ROOT + "/_footer.md.njk", options);
}

function buildError404(options: {}) {
	return nunjucks.render(SOURCE_ROOT + "/_404.md.njk", options);
}

function buildIndex({
	homepage,
	sidebar,
	footer,
	error404,
	pages,
	style,
}: {
	homepage: string;
	sidebar: string;
	footer: string;
	error404: string;
	pages: Page[];
	style: string;
}) {
	const alias: Record<string, string> = { "/_sidebar.md": "/" + sidebar, "/.*/_sidebar.md": "/" + sidebar };

	for (const { index, title, md } of pages) {
		alias["/" + index] = "/" + md;
		alias["/" + title] = "/" + md;
		alias["/" + encodeURIComponent(title).toUpperCase()] = "/" + md;
		alias["/" + encodeURIComponent(title).toLowerCase()] = "/" + md;
	}

	const script = `window.$docsify = JSON.parse(${JSON.stringify(
		JSON.stringify({
			name: "????????????QQ????????????",
			repo: "https://github.com/thwiki/touhou-group/",
			homepage,
			logo: "/logo.png",
			themeColor: "#f2b040",
			alias,
			subMaxLevel: 3,
			maxLevel: 2,
			routerMode: "history",
			notFoundPage: error404,
			loadSidebar: true,
			loadFooter: footer,
			executeScript: false,
			ga: "UA-131267722-6",
		})
	)});`;

	return nunjucks.render(SOURCE_ROOT + "/index.html.njk", {
		script,
		style,
	});
}

(async () => {
	const json = (await (await fetch(SOURCE_URL)).json()) as Result;
	const buildDate = DateTime.now();

	if ("error" in json) throw new Error(json.error.info);

	const text = json.parse.text?.["*"];
	if (text == null) throw new Error("parsed text not found");

	const title = json.parse.title;
	const revid = json.parse.revid ?? 0;
	const limitreportdata = json.parse?.limitreportdata ?? [];

	const dom = new JSDOM(text, { contentType: "text/html" });
	const document = dom.window.document;

	const parserOutput = document.querySelector(".mw-parser-output");
	if (parserOutput == null) throw new Error(".mw-parser-output not found");

	await del(SITE_ROOT);
	await makeDir(SITE_ROOT);

	await cpy(STATIC_ROOT + "/**", SITE_ROOT);
	await makeDir(SITE_ROOT + "/" + PAGES_ROOT);
	await makeDir(SITE_ROOT + "/" + LIB_ROOT);
	await makeDir(SITE_ROOT + "/" + IMAGES_ROOT);

	const copyLibs = [
		"node_modules/docsify/lib/themes/vue.css",
		"node_modules/docsify/lib/docsify.min.js",
		"node_modules/@alertbox/docsify-footer/src/docsify-footer.js",
		"node_modules/docsify/lib/plugins/ga.min.js",
	];

	await cpy(copyLibs, SITE_ROOT + "/" + LIB_ROOT, { flat: true });

	let markdown = "";
	markdown += "# ???????????? QQ ????????????\n";

	for (const childNode of parserOutput.children) {
		const tagName = childNode.tagName.toLowerCase();
		if (tagName === "ul") {
			markdown +=
				"\n" +
				Array.from(childNode.querySelectorAll("li"))
					.map((item) => `-  ${htmlToMarkdown(item.innerHTML)}\n`)
					.join("") +
				"\n";
		} else if (tagName === "table") {
			const table = Array.from(childNode.querySelectorAll("tr")).map((row) => {
				return Array.from(row.querySelectorAll("td,th")).map((cell) => htmlToMarkdown(cell.innerHTML));
			});
			markdown += "\n" + markdownTable(table) + "\n";
		} else if (/^h\d$/.test(tagName)) {
			const level = parseInt(tagName.substring(1), 10) - 1;
			if (level === 1) {
				markdown += `\n----------\n`;
			}
			markdown += `\n${"#".repeat(level)} ${childNode.querySelector(".mw-headline")?.textContent ?? ""}\n`;
		}
	}

	const contents = markdown.split(/\s*\n----------\n\s*/).filter((page) => page !== "");

	const pages: Page[] = contents.map((content, index) => {
		const title: string = content.match(/^#\s*(.+)$/m)?.[1] ?? "";
		const count: number = (content.match(/^\|\s/gm) ?? []).length - (content.match(/^\|\s*---/gm) ?? []).length * 2;
		const hash: string = getHash(content);

		return {
			index: index,
			title,
			count,
			content,
			hash,
			md: `${PAGES_ROOT}/${index}.${hash}.md`,
		};
	});
	const pagesWithoutHome = pages.slice(1);

	const homeHtml = buildHome({ text: pages[0].content, pages: pagesWithoutHome });
	const homeMd = `${PAGES_ROOT}/0.${getHash(homeHtml)}.md`;

	await fs.promises.writeFile(path.join(SITE_ROOT, homeMd), homeHtml, { encoding: "utf8" });
	for (const page of pagesWithoutHome) {
		await fs.promises.writeFile(path.join(SITE_ROOT, page.md), page.content, { encoding: "utf8" });
	}

	const sidebarHtml = buildSidebar({ pages: pagesWithoutHome });
	const sidebarMd = `_sidebar.${getHash(sidebarHtml)}.md`;
	await fs.promises.writeFile(path.join(SITE_ROOT, sidebarMd), sidebarHtml, { encoding: "utf8" });

	const editDate = DateTime.fromISO(
		(limitreportdata.find((report) => report.name === "cachereport-timestamp")?.[0] ?? "")
			.toString()
			.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1-$2-$3T$4:$5:$6")
	);

	const footerHtml = buildFooter({
		revid,
		title,
		editDate: editDate.setZone("Asia/Shanghai").setLocale("zh-Hans").toLocaleString(DateTime.DATETIME_FULL),
		buildDate: buildDate.setZone("Asia/Shanghai").setLocale("zh-Hans").toLocaleString(DateTime.DATETIME_FULL),
	});
	const footerMd = `_footer.${getHash(footerHtml)}.md`;
	await fs.promises.writeFile(path.join(SITE_ROOT, footerMd), footerHtml, { encoding: "utf8" });

	const error404Html = buildError404({});
	const error404Md = `_404.${getHash(error404Html)}.md`;
	await fs.promises.writeFile(path.join(SITE_ROOT, error404Md), error404Html, { encoding: "utf8" });

	const style = minify((await less.render(nunjucks.render(SOURCE_ROOT + "/styles.less", {}))).css).css;

	const indexHtml = buildIndex({ homepage: homeMd, sidebar: sidebarMd, footer: footerMd, error404: error404Md, pages, style });
	await fs.promises.writeFile(path.join(SITE_ROOT, "index.html"), indexHtml, {
		encoding: "utf8",
	});

	await Promise.all(
		IMAGE_URLS.map(async ({ from: imageFrom, to: imageTo }) => await fs.promises.writeFile(path.join(SITE_ROOT, imageTo), await download(imageFrom)))
	);

	await fs.promises.writeFile(
		path.join(SITE_ROOT, "info.json"),
		JSON.stringify({
			build: buildDate.toMillis(),
			edit: editDate.toMillis(),
			revid,
			title,
			pages: pages.map((page) => ({ index: page.index, title: page.title, count: page.count, md: page.md })),
		}),
		{
			encoding: "utf8",
		}
	);
})();
