/*!
 * PLATEAU MVT Research — TypeScript source module
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

import { OsEventTypeList } from '@evenrealities/even_hub_sdk';

/** protobuf は 0 を省略するため、単タップは eventType が undefined になる。 */
export function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null;
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT;
}

export function isDoubleClick(event: {
  sysEvent?: { eventType?: OsEventTypeList };
  textEvent?: { eventType?: OsEventTypeList };
}): boolean {
  const sysType = eventTypeOf(event.sysEvent);
  const textType = eventTypeOf(event.textEvent);
  return sysType === OsEventTypeList.DOUBLE_CLICK_EVENT
    || textType === OsEventTypeList.DOUBLE_CLICK_EVENT;
}

export function isScrollTop(event: {
  sysEvent?: { eventType?: OsEventTypeList };
  textEvent?: { eventType?: OsEventTypeList };
}): boolean {
  const sysType = eventTypeOf(event.sysEvent);
  const textType = eventTypeOf(event.textEvent);
  return sysType === OsEventTypeList.SCROLL_TOP_EVENT
    || textType === OsEventTypeList.SCROLL_TOP_EVENT;
}

export function isScrollBottom(event: {
  sysEvent?: { eventType?: OsEventTypeList };
  textEvent?: { eventType?: OsEventTypeList };
}): boolean {
  const sysType = eventTypeOf(event.sysEvent);
  const textType = eventTypeOf(event.textEvent);
  return sysType === OsEventTypeList.SCROLL_BOTTOM_EVENT
    || textType === OsEventTypeList.SCROLL_BOTTOM_EVENT;
}
