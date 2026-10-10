/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 *
 * ALL RIGHTS RESERVED. NO LICENSE IS GRANTED BY ACCESSING, VIEWING, OR COPYING THIS FILE.
 * THIS SOFTWARE AND ALL ASSOCIATED MATERIALS ARE PROPRIETARY TO KUWA-YA, LTD.
 * SOURCE CODE IS MADE PUBLICLY VIEWABLE ONLY FOR TRANSPARENCY AND INFORMATIONAL
 * PURPOSES. WITHOUT PRIOR WRITTEN PERMISSION FROM KUWA-YA, LTD., YOU MAY NOT USE,
 * COPY, REPRODUCE, MODIFY, ADAPT, TRANSLATE, CREATE DERIVATIVE WORKS FROM,
 * DISTRIBUTE, REDISTRIBUTE, PUBLISH, SUBLICENSE, SELL, RENT, LEASE, OR OTHERWISE
 * MAKE AVAILABLE ANY PART OF THIS SOFTWARE, OR USE IT FOR COMMERCIAL PURPOSES OR
 * TO DEVELOP OR PROVIDE ANY PRODUCT OR SERVICE. VIEWING DOES NOT GRANT ANY RIGHTS.
 * USE OF THE PUBLIC WEB APPLICATION IS GOVERNED BY ITS TERMS OF SERVICE ONLY AND
 * DOES NOT GRANT ANY RIGHT TO THIS SOURCE CODE. THE SOFTWARE IS PROVIDED "AS IS"
 * WITHOUT WARRANTY OF ANY KIND. SEE /legal/SOURCE-CODE-LICENSE.txt.
 */

/**
 * .ehpk 用: 用途地域の manifest + z12 索引を public/data/mvt に同期（Vite が dist へコピー）。
 * 事前に `npm run build:mvt-index:use-district`（リポジトリルート）が必要。
 */
import { access, cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hubAppRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(hubAppRoot, '..', '..', '..', '..');
const srcMvt = join(repoRoot, 'web', 'data', 'mvt');
const destRoot = join(hubAppRoot, 'public', 'data', 'mvt');

const datasetId = 'use-district-2025';
const manifestSrc = join(srcMvt, 'manifest', `${datasetId}.json`);
const indexSrc = join(srcMvt, 'index', datasetId);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(manifestSrc))) {
  console.error(
    `用途地域 manifest がありません: ${manifestSrc}\n`
    + 'リポジトリルートで npm run build:mvt-index:use-district を実行してください。'
  );
  process.exit(1);
}

if (!(await exists(indexSrc))) {
  console.error(
    `用途地域索引がありません: ${indexSrc}\n`
    + 'リポジトリルートで npm run build:mvt-index:use-district を実行してください。'
  );
  process.exit(1);
}

await mkdir(join(destRoot, 'manifest'), { recursive: true });
await mkdir(join(destRoot, 'index', datasetId), { recursive: true });
await cp(manifestSrc, join(destRoot, 'manifest', `${datasetId}.json`));
await cp(indexSrc, join(destRoot, 'index', datasetId), { recursive: true });

console.log(`同期: web/data/mvt (use-district) → hub-app/public/data/mvt`);
