export const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,31}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  if (!USERNAME_PATTERN.test(value.trim())) {
    return '账号需以字母开头，长度 3–32，仅含字母、数字和下划线。';
  }
  return null;
}

export function validatePassword(value: string) {
  if (value.length < 8 || value.length > 72) return '密码长度需为 8–72 个字符。';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return '密码需同时包含字母和数字。';
  return null;
}

export function validateDisplayName(value: string) {
  const name = value.trim();
  if (name.length < 1 || name.length > 40) return '显示名称长度需为 1–40 个字符。';
  return null;
}

export function validateOptionalEmail(value: string) {
  const email = value.trim();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return '邮箱格式不正确。';
  return null;
}
