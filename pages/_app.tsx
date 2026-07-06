import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/styles/globals.css';
import '@xterm/xterm/css/xterm.css';
import LockGuard from '@/components/LockGuard';
import AppShell from '@/components/AppShell';

export default function App({ Component, pageProps }: AppProps) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 5_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {/* Must come from next/head (not _document.tsx's Head), so it dedupes
          against Next's own default viewport tag instead of both rendering. */}
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <LockGuard>
        <AppShell>
          <Component {...pageProps} />
        </AppShell>
      </LockGuard>
    </QueryClientProvider>
  );
}
