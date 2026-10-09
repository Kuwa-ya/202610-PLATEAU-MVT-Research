/*!
 * ちずうつし (kuwaya-geo) — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: ./legal/SOURCE-CODE-LICENSE.txt
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
 * WITHOUT WARRANTY OF ANY KIND. SEE ./legal/SOURCE-CODE-LICENSE.txt.
 */

function isLocalHost(hostname = location.hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export async function fetchAccessCount({ url, key, countUp = !isLocalHost() }) {
  const endpoint = new URL(url);
  endpoint.searchParams.set('key', key);
  if (countUp) endpoint.searchParams.set('countup', '1');
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`アクセス数を取得できませんでした (${response.status})`);
  const data = await response.json();
  const count = Number(data?.count);
  if (!Number.isFinite(count)) throw new Error('アクセス数の応答が不正です。');
  return count;
}

export function bindAccessCount(element, options) {
  if (!element) return;
  void fetchAccessCount(options).then(count => {
    element.textContent = count.toLocaleString('ja-JP');
  }).catch(() => {});
}
