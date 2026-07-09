import { ImageResponse } from "next/og";

export const alt = "Email Verifier — check whether an email address is real and deliverable";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#09090b",
          color: "#fafafa",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 9999,
              backgroundColor: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#09090b",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 72, fontWeight: 700 }}>Email Verifier</div>
        </div>
        <div style={{ fontSize: 32, color: "#a1a1aa", maxWidth: 900 }}>
          Is that email address real? Syntax, mail servers, disposable
          domains, and typo checks — free.
        </div>
        <div style={{ fontSize: 28, color: "#818cf8", marginTop: 48 }}>
          verify.ejlee.io
        </div>
      </div>
    ),
    { ...size },
  );
}
