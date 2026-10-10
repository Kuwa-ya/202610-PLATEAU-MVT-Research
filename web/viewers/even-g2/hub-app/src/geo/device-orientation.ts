type DeviceOrientationCtor = {
  requestPermission?: () => Promise<string>;
};

function orientationCtor(): DeviceOrientationCtor | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  if (!('DeviceOrientationEvent' in globalThis)) return undefined;
  return (globalThis as typeof globalThis & { DeviceOrientationEvent?: DeviceOrientationCtor })
    .DeviceOrientationEvent;
}

export function isDeviceOrientationSupported(): boolean {
  return orientationCtor() !== undefined;
}

/** iOS 13+ のユーザージェスチャー付き許可が必要なときだけ true */
export function compassNeedsPermissionPrompt(): boolean {
  return typeof orientationCtor()?.requestPermission === 'function';
}
