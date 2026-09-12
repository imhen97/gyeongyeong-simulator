import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // 원본 프로그램 느낌의 고정폭 계열 (숫자 정렬용)
        mono: ["Consolas", "'D2Coding'", "'Malgun Gothic'", "monospace"],
      },
      colors: {
        // 등급 색상 (스펙 6-2: A=파랑, B=초록, C=검정, D=주황, E=빨강)
        grade: {
          a: "#1d4ed8",
          b: "#15803d",
          c: "#111827",
          d: "#c2410c",
          e: "#dc2626",
        },
      },
    },
  },
  plugins: [],
};

export default config;
