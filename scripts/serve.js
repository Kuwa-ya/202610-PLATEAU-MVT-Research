import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const siteRoot = resolve(repositoryRoot, process.env.SITE_ROOT ?? "web");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const mounts = [
  { prefix: "/modules", root: resolve(repositoryRoot, "node_modules") },
  { prefix: "/data", root: resolve(siteRoot, "data") },
  { prefix: "/kuwaya-geo", root: resolve(repositoryRoot, "docs/ref/kuwaya-geo") },
  { prefix: "", root: siteRoot }
];

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORTには1から65535までの整数を指定してください。");
}

if (!existsSync(siteRoot) || !statSync(siteRoot).isDirectory()) {
  throw new Error(`公開ディレクトリが見つかりません: ${siteRoot}`);
}

const DEVEGOKKO_CONFIG_URL = "https://www.kuwa-ya.co.jp/app/devegokko_v3_config.json";
let devegokkoConfigPromise = null;

function loadDevegokkoConfigForProxy() {
  if (!devegokkoConfigPromise) {
    devegokkoConfigPromise = fetch(DEVEGOKKO_CONFIG_URL, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`設定JSON HTTP ${response.status}`);
        }
        const config = await response.json();
        const key = config?.address?.api_key;
        const base = String(config?.address?.url ?? "").replace(/\/+$/, "");
        if (!key || !base) throw new Error("設定JSONの address ブロックが不正です。");
        return { apiKey: key, baseUrl: base };
      })
      .catch((error) => {
        devegokkoConfigPromise = null;
        throw error;
      });
  }
  return devegokkoConfigPromise;
}

async function proxyDevegokkoAddressGeocode(request, response, url) {
  if (request.method !== "GET") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method Not Allowed");
    return;
  }

  let proxyTarget;
  try {
    proxyTarget = await loadDevegokkoConfigForProxy();
  } catch (error) {
    response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`住所APIプロキシ: 設定JSONを読めません (${error.message})`);
    return;
  }

  const upstreamPath = url.pathname.replace(/^\/devegokko-api/, "") || "/";
  const upstreamUrl = new URL(upstreamPath + url.search, `${proxyTarget.baseUrl}/`);

  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Address-Api-Key": proxyTarget.apiKey,
    },
  });

  const body = Buffer.from(await upstream.arrayBuffer());
  response.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(body);
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mvt": "application/vnd.mapbox-vector-tile",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function resolveMountedFile(pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const sorted = [...mounts].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const mount of sorted) {
    if (mount.prefix && !decodedPath.startsWith(mount.prefix)) continue;
    const rest = mount.prefix ? decodedPath.slice(mount.prefix.length) : decodedPath;
    const requestPath = rest === "" || rest === "/" ? "index.html" : rest.replace(/^[/\\]+/, "");
    let candidate = normalize(resolve(mount.root, requestPath));
    let relativePath = relative(mount.root, candidate);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) continue;
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      candidate = normalize(resolve(candidate, "index.html"));
      relativePath = relative(mount.root, candidate);
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) continue;
    }
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);

  if (url.pathname.startsWith("/devegokko-api/")) {
    proxyDevegokkoAddressGeocode(request, response, url).catch((error) => {
      if (!response.headersSent) {
        response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(`住所APIプロキシ: ${error.message}`);
      }
    });
    return;
  }

  const candidate = resolveMountedFile(url.pathname);

  if (!candidate) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes[extname(candidate).toLowerCase()] ?? "application/octet-stream",
  });
  createReadStream(candidate).pipe(response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `ポート ${port} は使用中です。npm run dev は自動で解放を試みます。それでもダメなら PowerShell: $env:PORT=8080; npm run dev`
    );
    console.error(`詳細: ${error.message}`);
  } else {
    console.error(`ローカルサーバーを起動できません: ${error.message}`);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`PLATEAU MVT LAB:     http://${host}:${port}/`);
  console.log(`MapLibre Viewer:     http://${host}:${port}/viewers/maplibre/`);
  console.log(`Three Viewer:        http://${host}:${port}/viewers/three/`);
  console.log(`kuwaya-geo 参照:     http://${host}:${port}/kuwaya-geo/`);
  console.log(`静的索引 data/:      http://${host}:${port}/data/mvt/manifest/`);
  console.log(`住所APIプロキシ:     http://${host}:${port}/devegokko-api/address/geocode`);
});

export default server;
