export type DeviceType = 'desktop' | 'tablet' | 'mobile' | 'unknown';

export type ClientEnvironment = {
  browserName: string;
  browserVersion: string;
  operatingSystem: string;
  deviceType: DeviceType;
};

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? '';
}

function detectDevice(ua: string): DeviceType {
  if (!ua) return 'unknown';
  const ipadDesktopUa = /Macintosh/.test(ua) && /Mobile/.test(ua);
  if (/iPad/.test(ua) || ipadDesktopUa || /Tablet|PlayBook|Silk/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) {
    return 'tablet';
  }
  if (/Mobi|iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
  return 'desktop';
}

function detectBrowser(ua: string) {
  if (/Edg(?:e|A|iOS)?\//.test(ua) || /Edg\//.test(ua)) {
    return { browserName: 'Microsoft Edge', browserVersion: firstMatch(ua, /Edg(?:e|A|iOS)?\/([\d.]+)/) || firstMatch(ua, /Edg\/([\d.]+)/) };
  }
  if (/OPR\/|Opera\//.test(ua)) {
    return { browserName: 'Opera', browserVersion: firstMatch(ua, /(?:OPR|Opera)\/([\d.]+)/) };
  }
  if (/SamsungBrowser\//.test(ua)) {
    return { browserName: 'Samsung Internet', browserVersion: firstMatch(ua, /SamsungBrowser\/([\d.]+)/) };
  }
  if (/Firefox\/|FxiOS\//.test(ua)) {
    return { browserName: 'Firefox', browserVersion: firstMatch(ua, /(?:Firefox|FxiOS)\/([\d.]+)/) };
  }
  if (/Chrome\/|CriOS\//.test(ua) && !/Edg/.test(ua) && !/OPR\//.test(ua)) {
    return { browserName: 'Chrome', browserVersion: firstMatch(ua, /(?:Chrome|CriOS)\/([\d.]+)/) };
  }
  if (/Safari\//.test(ua) && !/Chrome|CriOS|Android/.test(ua)) {
    return { browserName: 'Safari', browserVersion: firstMatch(ua, /Version\/([\d.]+)/) || firstMatch(ua, /Safari\/([\d.]+)/) };
  }
  return { browserName: 'Other', browserVersion: '' };
}

function detectOs(ua: string) {
  if (/Windows NT 10/.test(ua)) return /Windows NT 10.0; Win64/.test(ua) ? 'Windows 10/11' : 'Windows 10';
  if (/Windows NT 6.3/.test(ua)) return 'Windows 8.1';
  if (/Windows NT 6.1/.test(ua)) return 'Windows 7';
  if (/Windows/.test(ua)) return 'Windows';
  if (/iPhone|iPad|iPod/.test(ua)) return `iOS ${firstMatch(ua, /OS ([\d_]+)/).replaceAll('_', '.') || ''}`.trim();
  if (/Mac OS X/.test(ua)) return `macOS ${firstMatch(ua, /Mac OS X ([\d_]+)/).replaceAll('_', '.') || ''}`.trim();
  if (/Android/.test(ua)) return `Android ${firstMatch(ua, /Android ([\d.]+)/)}`.trim();
  if (/CrOS/.test(ua)) return 'Chrome OS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

/**
 * 同时兼容经典 User-Agent 与 Chromium Client Hints。
 * Firefox / Safari 不发送 Sec-CH-UA，因此绝不能把 Client Hints 当作登录前置条件。
 */
export function parseClientEnvironment(userAgent: string, request?: Request): ClientEnvironment {
  const ua = userAgent || request?.headers.get('user-agent') || '';
  const parsed = { ...detectBrowser(ua), operatingSystem: detectOs(ua), deviceType: detectDevice(ua) };

  const chUa = request?.headers.get('sec-ch-ua');
  const chPlatform = request?.headers.get('sec-ch-ua-platform');
  if (chUa && parsed.browserName === 'Other') {
    if (/Microsoft Edge/i.test(chUa)) parsed.browserName = 'Microsoft Edge';
    else if (/Google Chrome/i.test(chUa)) parsed.browserName = 'Chrome';
    else if (/Firefox/i.test(chUa)) parsed.browserName = 'Firefox';
  }
  if (chPlatform && parsed.operatingSystem === 'Unknown') {
    parsed.operatingSystem = chPlatform.replaceAll('"', '');
  }
  return parsed;
}
