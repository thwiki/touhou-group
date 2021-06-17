import fetch from "node-fetch";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { markdownTable } from "markdown-table";
import nunjucks from "nunjucks";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import del from "del";
import makeDir from "make-dir";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

DOMPurify.addHook("uponSanitizeElement", function (node) {
  if (node?.nodeName === "A" && node?.hasAttribute("href")) {
    const img = node.querySelector("img");
    if (img && img.hasAttribute("src")) {
      node.textContent = `[![${img.getAttribute("title") ?? ""}](${img.getAttribute("src")})](${node.getAttribute("href")})`;
    } else {
      node.textContent = `[${node.textContent}](${node.getAttribute("href")})`;
    }
  } else if (node?.nodeName === "SPAN" && node.classList.contains("inside")) {
    const s = window.document.createElement("s");
    s.innerHTML = node.innerHTML;
    node.innerHTML = s.outerHTML;
  }
});

const SOURCE_URL = "https://thwiki.cc/index.php?title=%E4%B8%9C%E6%96%B9%E7%9B%B8%E5%85%B3QQ%E7%BE%A4%E7%BB%84%E5%88%97%E8%A1%A8&action=render";
const SITE_ROOT = "site";
const PAGES_ROOT = "pages";

function getHash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").substr(0, 8);
}

function htmlToMarkdown(html) {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ["b", "s", "i", "img", "br"] }).replace(/\s+/g, " ");
}

function buildHome(options) {
  return nunjucks.render("templates/home.md.njk", options);
}

function buildSidebar(options) {
  return nunjucks.render("templates/_sidebar.md.njk", options);
}

function buildIndex({ homepage, sidebar, pages }) {
  const alias = { ".*/_sidebar.md": "/" + sidebar };

  for (const { index, title, md } of pages) {
    alias["/" + index] = "/" + md;
    alias["/" + title] = "/" + md;
    alias["/" + encodeURIComponent(title).toUpperCase()] = "/" + md;
    alias["/" + encodeURIComponent(title).toLowerCase()] = "/" + md;
  }

  const script = `window.$docsify = JSON.parse(${JSON.stringify(
    JSON.stringify({
      name: "东方相关QQ群组列表",
      repo: "",
      homepage,
      logo: "/_media/logo.png",
      themeColor: "#f2b040",
      alias,
      subMaxLevel: 3,
      maxLevel: 2,
      routerMode: "history",
      loadSidebar: true,
      loadFooter: true,
      loadFooter: "_footer.md",
      executeScript: false,
    })
  )});(!!navigator.userAgent.match(/Trident/g) || !!navigator.userAgent.match(/MSIE/g)) && (window.$docsify.routerMode = 'hash');`;

  return nunjucks.render("templates/index.html.njk", {
    script,
  });
}

(async () => {
  const text = await (await fetch(SOURCE_URL)).text();
  const dom = new JSDOM(text, { contentType: "text/html" });
  const document = dom.window.document;

  const parserOutput = document.querySelector(".mw-parser-output");
  if (parserOutput == null) throw new Error(".mw-parser-output not found");

  await del(SITE_ROOT + "/_sidebar.*.md");
  await del(SITE_ROOT + "/" + PAGES_ROOT);
  await makeDir(SITE_ROOT + "/" + PAGES_ROOT);

  let markdown = "";
  markdown += "# 东方相关 QQ 群组列表\n";

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
      const level = parseInt(tagName.substr(1), 10) - 1;
      if (level === 1) {
        markdown += `\n----------\n`;
      }
      markdown += `\n${"#".repeat(level)} ${childNode.querySelector(".mw-headline")?.textContent ?? ""}\n`;
    }
  }

  const contents = markdown.split(/\s*\n----------\n\s*/).filter((page) => page !== "");

  const pages = contents.map((content, index) => {
    const title = content.match(/^#\s*(.+)$/m)?.[1] ?? "";
    const count = (content.match(/^\|\s/gm) ?? []).length - (content.match(/^\|\s*---/gm) ?? []).length * 2;
    const hash = getHash(content);

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

  const home = buildHome({ text: pages[0].content, pages: pagesWithoutHome });
  const homeMd = `${PAGES_ROOT}/0.${getHash(home)}.md`;

  await fs.promises.writeFile(path.join(SITE_ROOT, homeMd), home, { encoding: "utf8" });
  for (const page of pagesWithoutHome) {
    await fs.promises.writeFile(path.join(SITE_ROOT, page.md), page.content, { encoding: "utf8" });
  }

  const sidebar = buildSidebar({ pages: pagesWithoutHome });
  const sidebarMd = `_sidebar.${getHash(sidebar)}.md`;
  await fs.promises.writeFile(path.join(SITE_ROOT, sidebarMd), sidebar, { encoding: "utf8" });

  await fs.promises.writeFile(path.join(SITE_ROOT, "index.html"), buildIndex({ homepage: homeMd, sidebar: sidebarMd, pages }), { encoding: "utf8" });
})();
