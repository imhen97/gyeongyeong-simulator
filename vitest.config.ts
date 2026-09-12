import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 계산 엔진은 순수 Node 환경에서 테스트한다 (DOM 불필요).
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
