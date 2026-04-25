import React from "react";

export type ThemeOverride = {
  [elementId: string]: {
    background?: string;
    color?: string;
    border?: string;
    borderRadius?: string;
  };
};

interface Props {
  theme?: ThemeOverride;
}

export const PHANTOM_ELEMENT_MAP: Record<
  string,
  { x: number; y: number; width: number; height: number } | Array<{ x: number; y: number; width: number; height: number }>
> = {
  header:          { x: 0,   y: 0,   width: 400, height: 60  },
  "network-badge": { x: 152, y: 16,  width: 96,  height: 28  },
  "account-address":{ x: 16,  y: 68,  width: 368, height: 40  },
  "balance-sol":   { x: 0,   y: 118, width: 400, height: 48  },
  "balance-usd":   { x: 0,   y: 162, width: 400, height: 32  },
  "btn-send":      { x: 16,  y: 214, width: 82,  height: 64  },
  "btn-receive":   { x: 114, y: 214, width: 82,  height: 64  },
  "btn-swap":      { x: 212, y: 214, width: 82,  height: 64  },
  "btn-buy":       { x: 310, y: 214, width: 82,  height: 64  },
  "token-list-item": [
    { x: 16, y: 330, width: 368, height: 56 },
    { x: 16, y: 390, width: 368, height: 56 },
    { x: 16, y: 450, width: 368, height: 56 },
    { x: 16, y: 510, width: 368, height: 56 },
  ],
};

const t = (theme: ThemeOverride | undefined, id: string): React.CSSProperties =>
  (theme?.[id] ?? {}) as React.CSSProperties;

export function PhantomMockUI({ theme }: Props) {
  return (
    <div
      data-phantom-id="root"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: theme?.root?.background ?? "#131217",
        color: theme?.root?.color ?? "#ffffff",
        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        data-phantom-id="header"
        style={{
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          backgroundColor: theme?.header?.background ?? "#1e1c23",
          borderBottom: "1px solid #2a2832",
          flexShrink: 0,
          ...t(theme, "header"),
        }}
      >
        {/* Left: Ghost logo + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GhostIcon />
          <span style={{ fontSize: 16, fontWeight: 700, color: theme?.header?.color ?? "#ffffff", letterSpacing: "-0.3px" }}>
            Phantom
          </span>
        </div>

        {/* Center: Network badge */}
        <div
          data-phantom-id="network-badge"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            backgroundColor: theme?.["network-badge"]?.background ?? "#2a2832",
            border: `1px solid ${theme?.["network-badge"]?.border ?? "#3d3850"}`,
            borderRadius: 20,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 600,
            color: theme?.["network-badge"]?.color ?? "#ab9ff2",
            cursor: "pointer",
            ...t(theme, "network-badge"),
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#4ade80", flexShrink: 0, display: "inline-block" }} />
          Mainnet
          <ChevronDown />
        </div>

        {/* Right: menu icon */}
        <button style={iconBtn}>
          <DotsIcon />
        </button>
      </div>

      {/* ── Account row ─────────────────────────────────────────────────── */}
      <div
        data-phantom-id="account-address"
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: theme?.["account-address"]?.background ?? "#1e1c23",
          borderBottom: "1px solid #2a2832",
          flexShrink: 0,
          ...t(theme, "account-address"),
        }}
      >
        <div style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #ab9ff2 0%, #7c6fff 100%)",
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e8e8e8" }}>Account 1</span>
        <span style={{ fontSize: 12, color: "#666", fontFamily: "monospace" }}>8xKf…3mPq</span>
        <button style={iconBtn} title="Copy address">
          <CopyIcon />
        </button>
      </div>

      {/* ── Balance ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 20,
        paddingBottom: 12,
        flexShrink: 0,
      }}>
        <div
          data-phantom-id="balance-sol"
          style={{
            fontSize: 38,
            fontWeight: 700,
            color: theme?.["balance-sol"]?.color ?? "#ffffff",
            letterSpacing: "-1px",
            lineHeight: 1.1,
            ...t(theme, "balance-sol"),
          }}
        >
          12.48 SOL
        </div>
        <div
          data-phantom-id="balance-usd"
          style={{
            fontSize: 15,
            color: theme?.["balance-usd"]?.color ?? "#888888",
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
            ...t(theme, "balance-usd"),
          }}
        >
          $1,842.56
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#4ade80",
            backgroundColor: "rgba(74,222,128,0.12)",
            borderRadius: 6,
            padding: "2px 6px",
          }}>
            +2.3%
          </span>
        </div>
      </div>

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "0 16px",
        marginTop: 8,
        marginBottom: 12,
        flexShrink: 0,
      }}>
        {[
          { id: "btn-send",    icon: <SendIcon />,    label: "Send"    },
          { id: "btn-receive", icon: <ReceiveIcon />, label: "Receive" },
          { id: "btn-swap",    icon: <SwapIcon />,    label: "Swap"    },
          { id: "btn-buy",     icon: <BuyIcon />,     label: "Buy"     },
        ].map(({ id, icon, label }) => (
          <button
            key={id}
            data-phantom-id={id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              background: theme?.[id]?.background ?? "#2a2832",
              border: `1px solid ${theme?.[id]?.border ?? "#3d3850"}`,
              borderRadius: theme?.[id]?.borderRadius ?? "12px",
              padding: "12px 0",
              width: 82,
              cursor: "pointer",
              color: theme?.[id]?.color ?? "#ab9ff2",
              ...t(theme, id),
            }}
          >
            <div style={{ width: 24, height: 24 }}>{icon}</div>
            <span style={{ fontSize: 12, fontWeight: 500, color: theme?.[id]?.color ?? "#e8e8e8" }}>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid #2a2832",
        padding: "0 16px",
        flexShrink: 0,
      }}>
        {["Tokens", "NFTs", "Activity"].map((tab, i) => (
          <div
            key={tab}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: i === 0 ? "#ab9ff2" : "#555",
              borderBottom: i === 0 ? "2px solid #ab9ff2" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* ── Token list ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {TOKENS.map((token, i) => (
          <div
            key={token.symbol}
            data-phantom-id="token-list-item"
            data-token-index={i}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 16px",
              gap: 12,
              cursor: "pointer",
              transition: "background 0.1s",
            }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: token.gradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flexShrink: 0,
            }}>
              {token.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e8e8e8" }}>{token.name}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 1 }}>{token.amount} {token.symbol}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#e8e8e8" }}>{token.usd}</div>
              <div style={{ fontSize: 11, color: token.changeColor, marginTop: 1 }}>{token.change}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Static data ────────────────────────────────────────────────────────────

const TOKENS = [
  { symbol: "SOL",  name: "Solana",   icon: "◎", gradient: "linear-gradient(135deg,#9945FF,#14F195)", amount: "12.48",  usd: "$1,842.56", change: "+2.3%", changeColor: "#4ade80" },
  { symbol: "USDC", name: "USD Coin",  icon: "$", gradient: "linear-gradient(135deg,#2775CA,#5BC3FF)", amount: "100.00", usd: "$100.00",   change: "0.0%",  changeColor: "#888"    },
  { symbol: "BONK", name: "Bonk",      icon: "🐕", gradient: "linear-gradient(135deg,#f7931a,#ffcc00)", amount: "2.5M",   usd: "$18.40",    change: "-4.1%", changeColor: "#f87171" },
  { symbol: "JUP",  name: "Jupiter",   icon: "♃", gradient: "linear-gradient(135deg,#00c2ff,#8851ff)", amount: "45.00",  usd: "$32.10",    change: "+1.8%", changeColor: "#4ade80" },
];

// ── Icon components ────────────────────────────────────────────────────────

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 4,
  color: "#666",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function GhostIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M14 3C9.03 3 5 7.03 5 12v10l3-2.5 3 2.5 3-2.5 3 2.5 3-2.5V12C21 7.03 17 3 14 3z" fill="#ab9ff2" />
      <circle cx="10.5" cy="12" r="1.5" fill="white" />
      <circle cx="17.5" cy="12" r="1.5" fill="white" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="4" cy="9" r="1.5" fill="#888" />
      <circle cx="9" cy="9" r="1.5" fill="#888" />
      <circle cx="14" cy="9" r="1.5" fill="#888" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="4" width="9" height="9" rx="1.5" stroke="#666" strokeWidth="1.2" />
      <path d="M4 4V3C4 1.9 4.9 1 6 1h5c1.1 0 2 .9 2 2v5c0 1.1-.9 2-2 2h-1" stroke="#666" strokeWidth="1.2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 14V6M10 6L6 10M10 6L14 10" stroke="#ab9ff2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReceiveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 6v8M10 14L6 10M10 14l4-4" stroke="#ab9ff2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M5 8l3-3 3 3M8 5v8M15 12l-3 3-3-3M12 15V7" stroke="#ab9ff2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BuyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 6h1l2 7h8l2-6H7" stroke="#ab9ff2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="15.5" r="1" fill="#ab9ff2" />
      <circle cx="14" cy="15.5" r="1" fill="#ab9ff2" />
    </svg>
  );
}
