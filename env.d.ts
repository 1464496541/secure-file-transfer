declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
    RSA_PUBLIC_JWK: string;
    RSA_PRIVATE_JWK: string;
    SITE_URL?: string;
  }
}
