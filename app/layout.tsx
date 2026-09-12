import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "경영상태 데이터 수집기",
  description: "건설/전기공사업 입찰 적격심사 경영상태 시뮬레이터",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
