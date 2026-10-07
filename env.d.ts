declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
    RSA_PUBLIC_JWK: string;
    RSA_PRIVATE_JWK: string;
    SITE_URL?: string;
    ADMIN_INITIAL_PASSWORD?: string;
    WECHAT_APP_ID?: string;
    WECHAT_APP_SECRET?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
  }
}
