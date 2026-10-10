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
