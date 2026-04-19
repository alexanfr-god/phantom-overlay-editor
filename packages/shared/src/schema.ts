import { z } from "zod";

export const ElementTypeSchema = z.enum([
  "button",
  "input",
  "text",
  "image",
  "container",
]);

// ── Anchor system ────────────────────────────────────────
// Each anchor = a named region on a specific Phantom screen
// Overlay elements bind to anchors to auto-position

export const AnchorIdSchema = z.enum([
  // Password screen
  "background",
  "header",
  "header-title",
  "help-button",
  "header-line",
  "logo",
  "title",
  "password-input",
  "unlock-button",
  "forgot-link",
  // Welcome screen
  "welcome-logo",
  "welcome-subtitle",
  "create-wallet-button",
  "import-wallet-button",
  // Import screen
  "import-header",
  "import-subtitle",
  "option-email",
  "option-recovery",
  "option-private-key",
  "option-ledger",
]);

export type AnchorId = z.infer<typeof AnchorIdSchema>;

export const PhantomScreenSchema = z.enum([
  "password",
  "welcome",
  "import",
]);

export type PhantomScreen = z.infer<typeof PhantomScreenSchema>;

export interface Anchor {
  id: AnchorId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: ElementType; // suggested overlay element type
  styles?: Record<string, string>;   // override default styles
  content?: Record<string, unknown>; // override default content
}

export interface ScreenDefinition {
  id: PhantomScreen;
  label: string;
  anchors: Anchor[];
}

// Positions relative to 400x600 Phantom canvas
export const PHANTOM_SCREENS: ScreenDefinition[] = [
  {
    id: "password",
    label: "Password / Unlock",
    anchors: [
      {
        id: "background", label: "Background",
        x: 0, y: 0, width: 400, height: 600, type: "container",
        styles: {
          backgroundColor: "#1a1a2e",
          borderRadius: "0px",
          border: "none",
          background: "linear-gradient(180deg, #1a1a2e 0%, #111122 100%)",
        },
      },
      {
        id: "header", label: "Header bar",
        x: 0, y: 0, width: 400, height: 48, type: "container",
        styles: {
          backgroundColor: "#18181b",
          borderRadius: "0px",
          border: "none",
        },
      },
      {
        id: "header-title", label: "phantom",
        x: 140, y: 10, width: 120, height: 28, type: "text",
        styles: {
          color: "#ffffff",
          fontSize: "18px",
          fontWeight: "600",
          letterSpacing: "0.02em",
        },
        content: { text: "phantom" },
      },
      {
        id: "help-button", label: "? Button",
        x: 358, y: 10, width: 28, height: 28, type: "button",
        styles: {
          backgroundColor: "transparent",
          color: "#888888",
          borderRadius: "50%",
          border: "1px solid #444444",
          fontSize: "14px",
          fontWeight: "500",
        },
        content: { text: "?" },
      },
      {
        id: "header-line", label: "Separator",
        x: 0, y: 48, width: 400, height: 1, type: "container",
        styles: {
          backgroundColor: "#2a2a3a",
          borderRadius: "0px",
          border: "none",
        },
      },
      {
        id: "logo", label: "Ghost logo",
        x: 130, y: 100, width: 140, height: 150, type: "image",
        styles: {
          backgroundColor: "transparent",
          borderRadius: "0px",
          objectFit: "contain",
        },
        content: {
          src: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDI2NyAyMjIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHBhdGggZD0iTTMxLjU5NCAyMjJDNjUuNjY2IDIyMiA5MS4yNzEgMTkyLjQxNCAxMDYuNTUyIDE2OS4wMzRDMTA0LjY5NCAxNzQuMjA3IDEwMy42NjEgMTc5LjM3OSAxMDMuNjYxIDE4NC4zNDVDMTAzLjY2MSAxOTggMTExLjUwOCAyMDcuNzI0IDEyNi45OTUgMjA3LjcyNEMxNDguMjY1IDIwNy43MjQgMTcwLjk3OSAxODkuMTAzIDE4Mi43NDkgMTY5LjAzNEMxODEuOTIzIDE3MS45MzEgMTgxLjUxIDE3NC42MjEgMTgxLjUxIDE3Ny4xMDNDMTgxLjUxIDE4Ni42MjEgMTg2Ljg3OSAxOTIuNjIxIDE5Ny44MjQgMTkyLjYyMUMyMzIuMzA5IDE5Mi42MjEgMjY3IDEzMS41ODYgMjY3IDc4LjIwN0MyNjcgMzYuNjIxIDI0NS45MzcgMCAxOTMuMDc0IDBDMTAwLjE1MSAwIDAgMTEzLjM3OSAwIDE4Ni42MjFDMCAyMTUuMzc5IDE1LjQ4NyAyMjIgMzEuNTk0IDIyMlpNMTYxLjA2NyA3My42NTVDMTYxLjA2NyA2My4zMSAxNjYuODQ5IDU2LjA2OSAxNzUuMzE2IDU2LjA2OUMxODMuNTc1IDU2LjA2OSAxODkuMzU3IDYzLjMxIDE4OS4zNTcgNzMuNjU1QzE4OS4zNTcgODQgMTgzLjU3NSA5MS40NDggMTc1LjMxNiA5MS40NDhDMTY2Ljg0OSA5MS40NDggMTYxLjA2NyA4NCAxNjEuMDY3IDczLjY1NVpNMjA1LjI1OCA3My42NTVDMjA1LjI1OCA2My4zMSAyMTEuMDM5IDU2LjA2OSAyMTkuNTA2IDU2LjA2OUMyMjcuNzY2IDU2LjA2OSAyMzMuNTQ4IDYzLjMxIDIzMy41NDggNzMuNjU1QzIzMy41NDggODQgMjI3Ljc2NiA5MS40NDggMjE5LjUwNiA5MS40NDhDMjExLjAzOSA5MS40NDggMjA1LjI1OCA4NCAyMDUuMjU4IDczLjY1NVoiIGZpbGw9IiNGRkZERjgiLz4KPC9zdmc+Cg==",
        },
      },
      {
        id: "title", label: "Enter Password",
        x: 40, y: 290, width: 320, height: 36, type: "text",
        styles: {
          color: "#ffffff",
          fontSize: "22px",
          fontWeight: "600",
          textAlign: "center",
        },
        content: { text: "Enter your Password" },
      },
      {
        id: "password-input", label: "Password input",
        x: 24, y: 344, width: 352, height: 52, type: "input",
        styles: {
          backgroundColor: "#2c2c3a",
          color: "#e8e8e8",
          border: "1px solid #3a3a4a",
          borderRadius: "12px",
          padding: "0 16px",
          fontSize: "15px",
        },
        content: { placeholder: "Password" },
      },
      {
        id: "unlock-button", label: "Unlock",
        x: 24, y: 488, width: 352, height: 52, type: "button",
        styles: {
          backgroundColor: "#ab9ff2",
          color: "#1a1a2e",
          borderRadius: "14px",
          fontWeight: "600",
          fontSize: "16px",
        },
        content: { text: "Unlock" },
      },
      {
        id: "forgot-link", label: "Forgot Password?",
        x: 100, y: 556, width: 200, height: 24, type: "text",
        styles: {
          color: "#ab9ff2",
          fontSize: "14px",
          fontWeight: "500",
          textAlign: "center",
        },
        content: { text: "Forgot Password?" },
      },
    ],
  },
  {
    id: "welcome",
    label: "Welcome / Onboarding",
    anchors: [
      { id: "background",              label: "Background",        x: 0,   y: 0,   width: 400, height: 600, type: "container" },
      { id: "welcome-logo",            label: "Phantom logo",      x: 100, y: 80,  width: 200, height: 52,  type: "image" },
      { id: "welcome-subtitle",        label: "Subtitle text",     x: 30,  y: 152, width: 340, height: 48,  type: "text" },
      { id: "create-wallet-button",    label: "Create wallet",     x: 20,  y: 280, width: 360, height: 49,  type: "button" },
      { id: "import-wallet-button",    label: "I already have...", x: 20,  y: 345, width: 360, height: 49,  type: "button" },
    ],
  },
  {
    id: "import",
    label: "Import / Add Wallet",
    anchors: [
      { id: "background",         label: "Background",       x: 0,   y: 0,   width: 400, height: 600, type: "container" },
      { id: "import-header",      label: "Header",           x: 0,   y: 0,   width: 400, height: 52,  type: "container" },
      { id: "import-subtitle",    label: "How to add?",      x: 20,  y: 76,  width: 360, height: 24,  type: "text" },
      { id: "option-email",       label: "Connect Email",    x: 20,  y: 112, width: 360, height: 62,  type: "button" },
      { id: "option-recovery",    label: "Recovery Phrase",  x: 20,  y: 186, width: 360, height: 62,  type: "button" },
      { id: "option-private-key", label: "Private Key",      x: 20,  y: 260, width: 360, height: 62,  type: "button" },
      { id: "option-ledger",      label: "Ledger",           x: 20,  y: 334, width: 360, height: 62,  type: "button" },
    ],
  },
];

export function getScreenAnchors(screenId: PhantomScreen): Anchor[] {
  return PHANTOM_SCREENS.find((s) => s.id === screenId)?.anchors ?? [];
}

export function getAnchorById(screenId: PhantomScreen, anchorId: AnchorId): Anchor | undefined {
  return getScreenAnchors(screenId).find((a) => a.id === anchorId);
}

// ── Layout element (now with optional anchor binding) ────
export const LayoutElementSchema = z.object({
  id: z.string().uuid(),
  type: ElementTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  opacity: z.number().min(0).max(1).default(1.0),
  zIndex: z.number().int().default(0),
  locked: z.boolean().default(false),
  styles: z.record(z.string()).default({}),
  content: z.record(z.unknown()).default({}),
  label: z.string().optional(),
  anchor: AnchorIdSchema.optional(),      // bound to this anchor
  screen: PhantomScreenSchema.optional(),  // on this screen
});

export type ElementType = z.infer<typeof ElementTypeSchema>;
export type LayoutElement = z.infer<typeof LayoutElementSchema>;

export const LayoutDocumentSchema = z.object({
  version: z.literal("1"),
  timestamp: z.number(),
  elements: z.array(LayoutElementSchema),
  canvas: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  targetScreen: PhantomScreenSchema.optional(), // overlay only shows on this screen
});

export type LayoutDocument = z.infer<typeof LayoutDocumentSchema>;

export const DEFAULT_ELEMENT_SIZES: Record<ElementType, { width: number; height: number }> = {
  button: { width: 120, height: 40 },
  input: { width: 200, height: 40 },
  text: { width: 160, height: 24 },
  image: { width: 80, height: 80 },
  container: { width: 200, height: 100 },
};
