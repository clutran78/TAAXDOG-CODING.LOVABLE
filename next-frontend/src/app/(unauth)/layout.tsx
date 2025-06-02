
import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Login / Signup",
  description: "Authentication pages",
};

export default function UnauthLayout({ children }: { children: React.ReactNode }) {
  return (

    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      {children}
    </main>

  );
}
