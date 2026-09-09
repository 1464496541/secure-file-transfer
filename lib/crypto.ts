import { env } from 'cloudflare:workers';

const textEncoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function parseJwk(value: string | undefined, label: string): JsonWebKey {
  if (!value) throw new Error(`缺少 ${label}，请按照使用手册配置密钥。`);
  try {
    return JSON.parse(value) as JsonWebKey;
  } catch {
    throw new Error(`${label} 不是有效的 JWK JSON。`);
  }
}

async function importPublicKey() {
  return crypto.subtle.importKey(
    'jwk',
    parseJwk(env.RSA_PUBLIC_JWK, 'RSA_PUBLIC_JWK'),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['wrapKey'],
  );
}

async function importPrivateKey() {
  return crypto.subtle.importKey(
    'jwk',
    parseJwk(env.RSA_PRIVATE_JWK, 'RSA_PRIVATE_JWK'),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['unwrapKey'],
  );
}

export async function validateCryptoConfiguration() {
  await Promise.all([importPublicKey(), importPrivateKey()]);
}

export async function encryptFile(plain: ArrayBuffer, fileId: string, ownerId: string) {
  // 每个文件都使用全新的 256 位随机 AES 密钥和 96 位随机 IV。
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = textEncoder.encode(`${fileId}:${ownerId}`);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, aesKey, plain);

  // RSA 公钥只封装体积很小的 AES 密钥，兼顾性能与密钥分发安全性。
  const wrapped = await crypto.subtle.wrapKey('raw', aesKey, await importPublicKey(), { name: 'RSA-OAEP' });
  const digest = await crypto.subtle.digest('SHA-256', plain);
  const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return {
    encrypted,
    iv: bytesToBase64(iv),
    wrappedKey: bytesToBase64(new Uint8Array(wrapped)),
    sha256,
  };
}

export async function decryptFile(
  encrypted: ArrayBuffer,
  fileId: string,
  ownerId: string,
  iv: string,
  wrappedKey: string,
) {
  const aesKey = await crypto.subtle.unwrapKey(
    'raw',
    base64ToBytes(wrappedKey),
    await importPrivateKey(),
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv), additionalData: textEncoder.encode(`${fileId}:${ownerId}`) },
    aesKey,
    encrypted,
  );
}
