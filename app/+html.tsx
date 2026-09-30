import { ScrollViewStyleReset } from 'expo-router/html';

import { Colors } from '@/constants/theme';

// Web-only: configures the root HTML document. Without this, the browser's
// default white body shows through on any viewport wider than the app's
// content (or during the pre-hydration flash), instead of the app's own
// background - this makes that background match Colors[light/dark] via
// prefers-color-scheme, since this file has no access to the runtime
// color-scheme hook.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body { background-color: ${Colors.light.background}; }
              @media (prefers-color-scheme: dark) {
                html, body { background-color: ${Colors.dark.background}; }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
