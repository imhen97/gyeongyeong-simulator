/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3는 네이티브 모듈이라 서버 번들에서 외부 모듈로 취급한다.
  // (클라이언트 번들에는 절대 포함되면 안 된다 — DB 접근은 API 라우트에서만.)
  // Next 14에서는 experimental.serverComponentsExternalPackages 키를 쓴다.
  experimental: {
    // 네이티브/CJS 서버 라이브러리는 번들에 넣지 않고 런타임 require로 처리한다.
    serverComponentsExternalPackages: ["better-sqlite3", "pdf-parse"],
  },
};

export default nextConfig;
