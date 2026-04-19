import React, { useState } from "react";

// Phantom logo (ghost + wordmark) — from Figma MCP, valid 7 days
const FIGMA_LOGO_URL =
  "https://www.figma.com/api/mcp/asset/302d7f5c-6d8d-4e6e-8dc6-7db996d63c47";

// Import screen icons — from Figma MCP
const ICON_CONNECT  = "https://www.figma.com/api/mcp/asset/072d8108-ef63-4229-bcc6-ed03365135e6";
const ICON_RECOVERY = "https://www.figma.com/api/mcp/asset/dfdd048a-6506-4c6c-8426-c5e9edb57c93";
const ICON_KEY      = "https://www.figma.com/api/mcp/asset/be10277a-9e68-42b3-884f-1e7b88b536f1";
const ICON_LEDGER   = "https://www.figma.com/api/mcp/asset/ec65cd3d-a429-4b66-b121-95f71f066915";

type Screen = "password" | "welcome" | "import";

export function PhantomPasswordScreen() {
  const [screen, setScreen] = useState<Screen>("password");

  return (
    <div style={{
      width: 400,
      height: 600,
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#0c0c0c",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      overflow: "hidden",
      userSelect: "none",
    }}>
      {/* Dev screen switcher */}
      <div style={{
        display: "flex",
        backgroundColor: "#080808",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        {(["password", "welcome", "import"] as Screen[]).map((s) => (
          <button key={s} onClick={() => setScreen(s)} style={{
            flex: 1,
            height: 26,
            background: "none",
            border: "none",
            borderBottom: screen === s ? "2px solid #ab9ff2" : "2px solid transparent",
            color: screen === s ? "#ab9ff2" : "#444",
            fontSize: 9,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            transition: "color 0.15s",
          }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {screen === "password" && <PasswordScreen onSwitch={setScreen} />}
        {screen === "welcome"  && <WelcomeScreen  onSwitch={setScreen} />}
        {screen === "import"   && <ImportScreen   onSwitch={setScreen} />}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SCREEN: Password / Unlock
   Reference: user screenshot (real Phantom, RU locale)
   Translated to EN as requested
══════════════════════════════════════════════════════ */
function PasswordScreen({ onSwitch }: { onSwitch: (s: Screen) => void }) {
  const [showPw, setShowPw] = useState(false);

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#0c0c0c",
    }}>

      {/* ① TOP BAR ─────────────────────────────────────
          Real: ~52px tall, "phantom" bold centered,
          "?" circle icon right, 1px separator bottom      */}
      <div style={{
        height: 52,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <span style={{
          color: "#ffffff",
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}>
          phantom
        </span>

        {/* ? button — circle, right side */}
        <div style={{
          position: "absolute",
          right: 16,
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}>
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
            ?
          </span>
        </div>
      </div>

      {/* ② BODY */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 20px",
      }}>

        {/* ③ GHOST ────────────────────────────────────
            Real: large white ghost, asymmetric blob,
            leans slightly right, 2 rounded bumps at bottom,
            2 small ∪ closed eyes in upper face area
            Size: ~140px tall                              */}
        <div style={{ marginTop: 32, marginBottom: 20, lineHeight: 0 }}>
          <PhantomGhost />
        </div>

        {/* ④ TITLE ────────────────────────────────────
            Real: "Введите пароль" → EN: "Enter password"
            ~22-24px, bold 700, pure white, centered        */}
        <h1 style={{
          color: "#ffffff",
          fontSize: 23,
          fontWeight: 700,
          margin: "0 0 18px 0",
          letterSpacing: "-0.02em",
          textAlign: "center",
        }}>
          Enter password
        </h1>

        {/* ⑤ INPUT ────────────────────────────────────
            Real: transparent bg, 1px white border ~15% opacity,
            border-radius ~12px, h~50px, placeholder left-aligned
            Has eye icon on right (visible in real app)     */}
        <div style={{ width: "100%", position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            placeholder="Password"
            readOnly
            style={{
              width: "100%",
              height: 52,
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 12,
              color: "#ffffff",
              fontSize: 15,
              padding: "0 46px 0 14px",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => setShowPw(v => !v)}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.3)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <EyeIcon open={showPw} />
          </button>
        </div>

        {/* Flex spacer — pushes button to bottom (matches real Phantom large gap) */}
        <div style={{ flex: 1 }} />

        {/* ⑥ UNLOCK BUTTON ─────────────────────────────
            Real: "Разблокировать" → EN: "Unlock"
            Color: #ab9ff2 (lavender)
            Border-radius: PILL ~28-30px (key difference!)
            Height: ~54px
            Text: dark #111, 16px bold
            Press: slight scale + opacity                   */}
        <UnlockButton label="Unlock" style={{ marginBottom: 14 }} />

        {/* ⑦ FORGOT PASSWORD ──────────────────────────
            Real: "Забыли пароль?" → EN: "Forgot password?"
            White, ~14px, slightly muted, centered
            Hover: brightens                                */}
        <ForgotLink label="Forgot password?" style={{ marginBottom: 28 }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SCREEN: Welcome / Onboarding
   Source: Figma node 3:460
══════════════════════════════════════════════════════ */
function WelcomeScreen({ onSwitch }: { onSwitch: (s: Screen) => void }) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      backgroundColor: "#1e1e1e",
      padding: "0 20px",
    }}>
      <div style={{ height: 80 }} />

      {/* Logo — Figma asset (ghost + "phantom" wordmark) */}
      <div style={{ marginBottom: 20 }}>
        <img
          src={FIGMA_LOGO_URL}
          alt="phantom"
          height={52}
          style={{ display: "block" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      <p style={{
        color: "#fff",
        fontSize: 16,
        textAlign: "center",
        margin: "0 0 80px 0",
        lineHeight: 1.5,
        maxWidth: 340,
        fontWeight: 400,
      }}>
        To get started, create a new wallet or import an existing one.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 360 }}>
        <button style={{
          height: 49,
          backgroundColor: "#ab9ff2",
          border: "none",
          borderRadius: 10,
          color: "#111",
          fontSize: 16,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.9")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
        >
          Create a new wallet
        </button>

        <button
          onClick={() => onSwitch("password")}
          style={{
            height: 49,
            backgroundColor: "#2a2a2a",
            border: "none",
            borderRadius: 10,
            color: "#fff",
            fontSize: 16,
            fontWeight: 400,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.8")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
        >
          I already have a wallet
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SCREEN: Import Wallet
   Source: Figma Button variants
══════════════════════════════════════════════════════ */
function ImportScreen({ onSwitch }: { onSwitch: (s: Screen) => void }) {
  const options = [
    { icon: ICON_CONNECT,  title: "Connect Email Wallet",    sub: "Use your Apple ID or Google account" },
    { icon: ICON_RECOVERY, title: "Import Recovery Phrase",  sub: "Import accounts from another wallet" },
    { icon: ICON_KEY,      title: "Import Private Key",      sub: "Import a single-chain account" },
    { icon: ICON_LEDGER,   title: "Connect Hardware Wallet", sub: "Use your Ledger hardware wallet" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#1e1e1e" }}>
      {/* Back button */}
      <div style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <button onClick={() => onSwitch("welcome")} style={{
          position: "absolute",
          left: 12,
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.6)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          padding: 4,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>Add / Connect Wallet</span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 20px", gap: 12 }}>
        <p style={{ color: "#fff", fontSize: 15, margin: "0 0 8px 0", textAlign: "center" }}>
          How would you like to add a wallet?
        </p>

        {options.map(({ icon, title, sub }) => (
          <button key={title} style={{
            width: "100%",
            maxWidth: 360,
            height: 62,
            backgroundColor: "#2a2a2a",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 16px",
            cursor: "pointer",
            boxSizing: "border-box",
            textAlign: "left",
            transition: "background 0.12s",
          }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#333")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#2a2a2a")}
          >
            <img src={icon} alt="" width={32} height={32} style={{ flexShrink: 0, borderRadius: 4 }}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
            <div>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>{title}</div>
              <div style={{ color: "#888", fontSize: 12, fontFamily: "inherit", marginTop: 2 }}>{sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Shared UI components ─────────────────────────── */

function UnlockButton({ label, style: ext }: { label: string; style?: React.CSSProperties }) {
  const [pressed, setPressed] = useState(false);
  const [hover, setHover]     = useState(false);
  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => { setPressed(false); setHover(false); }}
      onMouseEnter={() => setHover(true)}
      style={{
        width: "100%",
        height: 54,
        backgroundColor: "#ab9ff2",
        border: "none",
        // PILL border-radius — key fix based on real screenshot
        borderRadius: 100,
        color: "#111111",
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        letterSpacing: "-0.01em",
        opacity: hover && !pressed ? 0.92 : pressed ? 0.78 : 1,
        transform: pressed ? "scale(0.978)" : "scale(1)",
        transition: "opacity 0.1s, transform 0.1s",
        ...ext,
      }}
    >
      {label}
    </button>
  );
}

function ForgotLink({ label, style: ext }: { label: string; style?: React.CSSProperties }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "none",
        border: "none",
        color: hover ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)",
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "color 0.15s",
        padding: "4px 8px",
        ...ext,
      }}
    >
      {label}
    </button>
  );
}

/* ── Phantom Ghost SVG ─────────────────────────────
   Pixel-traced from real Phantom screenshot:
   - Asymmetric blob, leans slightly right
   - Rounded teardrop body, wider at top
   - 2 small bumps at bottom (feet)
   - 2 small ∪ closed crescent eyes
   - Pure white fill
─────────────────────────────────────────────────── */
function PhantomGhost() {
  return (
    <svg width="138" height="148" viewBox="0 0 138 148" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body: asymmetric teardrop, leans right, 2 bumps at bottom */}
      <path
        d={[
          "M69 8",
          "C40 8 17 31 17 60",
          "L17 118",
          // Left foot bump
          "Q17 126 24 126",
          "Q31 126 36 120",
          "Q40 114 46 114",
          "Q52 114 55 120",
          // Center
          "Q58 126 64 126",
          "Q70 126 73 120",
          // Right foot bump
          "Q77 114 83 114",
          "Q89 114 93 120",
          "Q97 126 104 126",
          "Q111 126 111 118",
          "L111 60",
          "C111 31 98 8 69 8 Z",
        ].join(" ")}
        fill="white"
      />
      {/* Left eye — small ∪ arc */}
      <path
        d="M48 56 Q54 64 60 56"
        stroke="#0c0c0c"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right eye — small ∪ arc */}
      <path
        d="M76 56 Q82 64 88 56"
        stroke="#0c0c0c"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/* ── Eye toggle icon ──────────────────────────────── */
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
