import type { AppProps } from 'next/app';
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
      <LockGuard>
        <AppShell>
          <Component {...pageProps} />
        </AppShell>
      </LockGuard>
    </QueryClientProvider>
  );
}
