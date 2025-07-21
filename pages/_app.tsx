import "../styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
// import { ErrorBoundary } from "../components/ErrorBoundary";
import { useEffect } from "react";
// import { ClientMonitor } from "../lib/monitoring/client";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  // Temporarily disable all monitoring and error handling to debug redirect loop
  
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}