import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login / Signup",
  description: "Authentication pages",
};

export default function UnauthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="min-h-screen">{children}</main>;
}
