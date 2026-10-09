import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const siteRoot = resolve(repositoryRoot, process.env.SITE_ROOT ?? "site");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORTには1から65535までの整数を指定してください。");
}

if (!existsSync(siteRoot) || !statSync(siteRoot).isDirectory()) {
  throw new Error(`公開ディレクトリが見つかりません: ${siteRoot}`);
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function resolveRequestPath(pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const requestPath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^[/\\]+/, "");
  const candidate = normalize(resolve(siteRoot, requestPath));
  const relativePath = relative(siteRoot, candidate);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return candidate;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const candidate = resolveRequestPath(url.pathname);

  if (!candidate || !existsSync(candidate) || !statSync(candidate).isFile()) {
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
  console.error(`ローカルサーバーを起動できません: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`PLATEAU MVT LAB: http://${host}:${port}/`);
});

export default server;
