import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';

const crypto = webcrypto;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

test('AES-GCM 文件密钥可以由 RSA-OAEP 封装并恢复', async () => {
  const rsa = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    false,
    ['wrapKey', 'unwrapKey'],
  );
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = encoder.encode('file-id:user-id');
  const plain = encoder.encode('密盾传输加密测试文件');
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, aes, plain);
  const wrapped = await crypto.subtle.wrapKey('raw', aes, rsa.publicKey, { name: 'RSA-OAEP' });
  const restored = await crypto.subtle.unwrapKey(
    'raw', wrapped, rsa.privateKey, { name: 'RSA-OAEP' }, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad }, restored, encrypted);
  assert.equal(decoder.decode(decrypted), '密盾传输加密测试文件');
});

test('AES-GCM 会拒绝被篡改的密文', async () => {
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, encoder.encode('important')));
  encrypted[0] ^= 1;
  await assert.rejects(() => crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aes, encrypted));
});

test('AES-GCM 会拒绝与文件身份不匹配的附加认证数据', async () => {
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode('file-a:owner-a') },
    aes,
    encoder.encode('bound-to-file-and-owner'),
  );

  await assert.rejects(() =>
    crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: encoder.encode('file-b:owner-a') },
      aes,
      encrypted,
    ),
  );
  await assert.rejects(() =>
    crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: encoder.encode('file-a:owner-b') },
      aes,
      encrypted,
    ),
  );
});

test('错误的 RSA 私钥无法解封文件密钥', async () => {
  const [ownerKeys, attackerKeys] = await Promise.all([
    crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      false,
      ['wrapKey', 'unwrapKey'],
    ),
    crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      false,
      ['wrapKey', 'unwrapKey'],
    ),
  ]);
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const wrapped = await crypto.subtle.wrapKey('raw', aes, ownerKeys.publicKey, { name: 'RSA-OAEP' });

  await assert.rejects(() =>
    crypto.subtle.unwrapKey(
      'raw',
      wrapped,
      attackerKeys.privateKey,
      { name: 'RSA-OAEP' },
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    ),
  );
});
