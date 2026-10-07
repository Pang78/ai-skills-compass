import fs from "node:fs";
import path from "node:path";

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  
  if (content.includes('fixPreloadAs(html)') && !content.includes('<script id="_R_" type="module">') && !content.includes('<script id=\\"_R_\\" type=\\"module\\">')) {
    const searchTarget = 'function fixPreloadAs(html) {\n\treturn html.replace';
    const altTarget = 'function fixPreloadAs(html) {\n  return html.replace';
    const inlineTarget = 'function fixPreloadAs(html) { return html.replace';

    let replaced = false;
    if (content.includes(searchTarget)) {
      content = content.replace(searchTarget, 'function fixPreloadAs(html) {\n\treturn html.replace(/<script id="_R_">/g, \'<script id="_R_" type="module">\').replace');
      replaced = true;
    } else if (content.includes(altTarget)) {
      content = content.replace(altTarget, 'function fixPreloadAs(html) {\n  return html.replace(/<script id="_R_">/g, \'<script id="_R_" type="module">\').replace');
      replaced = true;
    } else if (content.includes(inlineTarget)) {
      content = content.replace(inlineTarget, 'function fixPreloadAs(html) { return html.replace(/<script id="_R_">/g, \'<script id="_R_" type="module">\').replace');
      replaced = true;
    }

    if (replaced) {
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`[patch-vinext] Successfully patched ${path.relative(process.cwd(), filePath)}`);
    }
  }
}

patchFile(path.resolve(process.cwd(), "node_modules/vinext/dist/server/app-ssr-stream.js"));
patchFile(path.resolve(process.cwd(), "dist/server/ssr/index.js"));
