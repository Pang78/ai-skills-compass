import fs from "node:fs";
import path from "node:path";

function patchServerFiles() {
  const filesToPatch = [
    path.resolve(process.cwd(), "node_modules/vinext/dist/server/app-ssr-stream.js"),
    path.resolve(process.cwd(), "node_modules/vinext/dist/server/app-ssr-entry.js"),
    path.resolve(process.cwd(), "dist/server/ssr/index.js")
  ];

  for (const filePath of filesToPatch) {
    if (!fs.existsSync(filePath)) continue;
    let content = fs.readFileSync(filePath, "utf-8");
    let modified = false;

    // 1. Transform bootstrap inline script: <script id="_R_">import("...")</script> -> <script id="_R_" type="module" src="..."></script>
    if (content.includes('import("') && content.includes('<script id="_R_">')) {
      content = content.replace(
        /<script id="_R_">(?:type="module">)?import\(["']([^"']+)["']\)<\/script>/g,
        '<script id="_R_" type="module" src="$1"></script>'
      );
      modified = true;
    }

    // 2. Transform fixPreloadAs to convert any remaining <script id="_R_">import("...")</script>
    if (content.includes("fixPreloadAs(html)")) {
      content = content.replace(
        /function fixPreloadAs\(html\) \{[\s\S]*?return html\.replace\(/,
        (match) => match.includes('src="$1"') ? match : match.replace(
          'return html.replace(',
          'return html.replace(/<script id="_R_">(?:type="module">)?import\\(["\']([^"\']+)["\']\\)<\\/script>/g, \'<script id="_R_" type="module" src="$1"></script>\').replace('
        )
      );
      modified = true;
    }

    // 3. Convert RSC chunk inline scripts to JSON data tags
    const chunkScriptOld = 'self.__VINEXT_RSC_CHUNKS__=self.__VINEXT_RSC_CHUNKS__||[];self.__VINEXT_RSC_CHUNKS__.push(';
    if (content.includes(chunkScriptOld)) {
      content = content.replace(
        /createInlineScriptTag\(\s*"self\.__VINEXT_RSC_CHUNKS__=self\.__VINEXT_RSC_CHUNKS__\|\|\[\];self\.__VINEXT_RSC_CHUNKS__\.push\("\s*\+\s*safeJsonStringify\(chunk\)\s*\+\s*"\)"\s*,\s*scriptNonce\s*\)/g,
        '\'<script type="application/json" class="v-chunk">\' + safeJsonStringify(chunk) + \'</script>\''
      );
      modified = true;
    }

    // 4. Convert DONE inline script to JSON data tag
    if (content.includes('self.__VINEXT_RSC_DONE__=true')) {
      content = content.replace(
        /createInlineScriptTag\(\s*"self\.__VINEXT_RSC_DONE__=true"\s*,\s*scriptNonce\s*\)/g,
        '\'<script type="application/json" class="v-done">true</script>\''
      );
      modified = true;
    }

    // 5. Convert PARAMS & NAV inline scripts to JSON data tags
    if (content.includes('self.__VINEXT_RSC_PARAMS__=')) {
      content = content.replace(
        /createInlineScriptTag\(\s*"self\.__VINEXT_RSC_PARAMS__="\s*\+\s*safeJsonStringify\(([^)]+)\)\s*,\s*scriptNonce\s*\)/g,
        '\'<script type="application/json" class="v-params">\' + safeJsonStringify($1) + \'</script>\''
      );
      content = content.replace(
        /createInlineScriptTag\(\s*"self\.__VINEXT_RSC_NAV__="\s*\+\s*safeJsonStringify\(([^)]+)\)\s*,\s*scriptNonce\s*\)/g,
        '\'<script type="application/json" class="v-nav">\' + safeJsonStringify($1) + \'</script>\''
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`[patch-vinext] Patched server file: ${path.relative(process.cwd(), filePath)}`);
    }
  }
}

function patchClientAssets() {
  const assetsDir = path.resolve(process.cwd(), "dist/client/assets");
  if (!fs.existsSync(assetsDir)) return;

  const files = fs.readdirSync(assetsDir);
  for (const file of files) {
    if (!file.endsWith(".js")) continue;
    const filePath = path.join(assetsDir, file);
    let content = fs.readFileSync(filePath, "utf-8");

    if (content.includes("__VINEXT_RSC_CHUNKS__") && !content.includes("v-chunk")) {
      const injection = `if(typeof document!=="undefined"){let _g=Bn();if(!_g.__VINEXT_RSC_CHUNKS__||_g.__VINEXT_RSC_CHUNKS__.length===0){_g.__VINEXT_RSC_CHUNKS__=[];document.querySelectorAll('script[type="application/json"].v-chunk').forEach(el=>{try{_g.__VINEXT_RSC_CHUNKS__.push(JSON.parse(el.textContent||""))}catch{}})}if(document.querySelector('script[type="application/json"].v-done'))_g.__VINEXT_RSC_DONE__=true;if(!_g.__VINEXT_RSC_PARAMS__){let p=document.querySelector('script[type="application/json"].v-params');if(p)try{_g.__VINEXT_RSC_PARAMS__=JSON.parse(p.textContent||"")}catch{}}if(!_g.__VINEXT_RSC_NAV__){let v=document.querySelector('script[type="application/json"].v-nav');if(v)try{_g.__VINEXT_RSC_NAV__=JSON.parse(v.textContent||"")}catch{}}}`;
      
      content = content.replace(
        /function Un\(\)\{let e=new TextEncoder;return new ReadableStream\(\{start\(t\)\{let n=Bn\(\),r=/g,
        `function Un(){let e=new TextEncoder;return new ReadableStream({start(t){let n=Bn();${injection}let r=`
      );

      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`[patch-vinext] Patched client asset: ${file}`);
    }
  }
}

patchServerFiles();
patchClientAssets();
