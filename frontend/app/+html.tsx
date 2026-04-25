// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* PWA — install on phone home screen (Android Chrome + iOS Safari) */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="application-name" content="Radio Check" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Radio Check" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />

        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --app-background: #f5f7fa;
                --app-border: #e5e7eb;
              }
              :root.dark-mode {
                --app-background: #0f1419;
                --app-border: #2d3748;
              }
              html, body {
                background-color: var(--app-background) !important;
                transition: background-color 0.2s ease;
              }
              /* Only apply mobile container styling on smaller screens */
              @media (max-width: 900px) {
                body > div:first-child { 
                  position: fixed !important; 
                  top: 0; 
                  left: 50% !important;
                  transform: translateX(-50%) !important;
                  right: auto !important;
                  bottom: 0; 
                  width: 100%;
                  max-width: 480px !important;
                  box-shadow: 0 0 40px rgba(0,0,0,0.3);
                  border-left: 1px solid var(--app-border);
                  border-right: 1px solid var(--app-border);
                }
              }
              /* On desktop, let ResponsiveWrapper handle the layout */
              @media (min-width: 901px) {
                body > div:first-child { 
                  position: relative !important;
                  left: auto !important;
                  transform: none !important;
                  width: 100% !important;
                  max-width: none !important;
                  box-shadow: none;
                  border: none;
                }
              }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('@veterans_app_theme');
                  if (theme === 'dark' || theme === '"dark"') {
                    document.documentElement.classList.add('dark-mode');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
