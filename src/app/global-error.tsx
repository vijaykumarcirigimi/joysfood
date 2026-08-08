"use client";

import { useEffect } from "react";

/**
 * Last line of defence: catches errors thrown by the root layout itself.
 *
 * When this renders, the root layout is gone — which means no globals.css, no
 * fonts, no design tokens. Everything here is inline styles for that reason,
 * and it renders its own <html> and <body>. Resist the urge to import shared
 * components; anything imported is something else that can fail here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fffdfb",
          color: "#221c15",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <p
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#e2571e",
              margin: 0,
            }}
          >
            Joy&rsquo;s Food
          </p>
          <h1 style={{ fontSize: "1.25rem", marginTop: "1.5rem" }}>
            The site is having a moment
          </h1>
          <p style={{ color: "#7c7268", lineHeight: 1.6 }}>
            Something failed before the page could load. Please try again, or
            call us if you need an order sorted right now.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#e2571e",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: "1.5rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#7c7268",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
