import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'jwk' },
  privateKeyEncoding: { type: 'pkcs8', format: 'jwk' },
});

const content = [
  `RSA_PUBLIC_JWK=${JSON.stringify(publicKey)}`,
  `RSA_PRIVATE_JWK=${JSON.stringify(privateKey)}`,
  '',
].join('\n');

const output = resolve('.env');
writeFileSync(output, content, { encoding: 'utf8', mode: 0o600 });
console.log(`RSA-OAEP 密钥已生成并写入 ${output}`);
console.log('请妥善备份 .env；丢失私钥后，已有文件将无法解密。');
