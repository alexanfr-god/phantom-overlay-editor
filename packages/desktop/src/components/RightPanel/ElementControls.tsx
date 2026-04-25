import React from "react";
import { useLayoutStore } from "../../store/layoutStore";
import { NumericInput } from "../shared/NumericInput";

export function ElementControls() {
  const elements = useLayoutStore((s) => s.elements);
  const selectedId = useLayoutStore((s) => s.selectedId);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const groups = useLayoutStore((s) => s.groups);
  const updateElement = useLayoutStore((s) => s.updateElement);
  const removeElement = useLayoutStore((s) => s.removeElement);
  const duplicateElement = useLayoutStore((s) => s.duplicateElement);
  const toggleLock = useLayoutStore((s) => s.toggleLock);
  const bringForward = useLayoutStore((s) => s.bringForward);
  const sendBackward = useLayoutStore((s) => s.sendBackward);
  const groupSelected = useLayoutStore((s) => s.groupSelected);
  const ungroupSelected = useLayoutStore((s) => s.ungroupSelected);

  const inGroup = selectedId ? Object.values(groups).some((g) => g.includes(selectedId)) : false;

  const el = elements.find((e) => e.id === selectedId);

  if (!el) {
    return (
      <div style={{ padding: 16, color: "#555", fontSize: 13, textAlign: "center", marginTop: 40 }}>
        Select an element to edit
      </div>
    );
  }

  const u = (patch: Parameters<typeof updateElement>[1]) =>
    updateElement(el.id, patch);

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {el.type}
          </div>
          <div style={{ fontSize: 13, color: "#e8e8e8", marginTop: 2 }}>
            {el.label ?? el.id.slice(0, 8)}
          </div>
          {el.anchor && (
            <div style={{ fontSize: 10, color: "#ab9ff2", marginTop: 2 }}>
              ⚓ {el.anchor}
            </div>
          )}
        </div>
        <button
          onClick={() => toggleLock(el.id)}
          title={el.locked ? "Unlock" : "Lock"}
          style={{
            background: el.locked ? "rgba(171,159,242,0.15)" : "transparent",
            border: "1px solid #3a3a3a",
            borderRadius: 6,
            color: el.locked ? "#ab9ff2" : "#888",
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {el.locked ? "🔒" : "🔓"}
        </button>
      </div>

      {/* Position */}
      <Section title="Position">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <NumericInput label="X" value={el.x} onChange={(v) => u({ x: v })} min={0} max={400} disabled={el.locked} />
          <NumericInput label="Y" value={el.y} onChange={(v) => u({ y: v })} min={0} max={600} disabled={el.locked} />
        </div>
      </Section>

      {/* Size */}
      <Section title="Size">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <NumericInput label="W" value={el.width} onChange={(v) => u({ width: Math.max(1, v) })} min={1} unit="px" disabled={el.locked} />
          <NumericInput label="H" value={el.height} onChange={(v) => u({ height: Math.max(1, v) })} min={1} unit="px" disabled={el.locked} />
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <NumericInput
          label="Opacity"
          value={Math.round(el.opacity * 100)}
          onChange={(v) => u({ opacity: v / 100 })}
          min={0} max={100} unit="%"
        />
        <div style={{ marginTop: 8 }}>
          <NumericInput
            label="Z-Index"
            value={el.zIndex}
            onChange={(v) => u({ zIndex: Math.round(v) })}
            min={0}
          />
        </div>
      </Section>

      {/* Content */}
      {(el.type === "button" || el.type === "text") && (
        <Section title="Content">
          <ContentInput label="Text" value={String(el.content.text ?? "")}
            onChange={(v) => u({ content: { ...el.content, text: v } })} />
        </Section>
      )}
      {el.type === "input" && (
        <Section title="Content">
          <ContentInput label="Placeholder" value={String(el.content.placeholder ?? "")}
            onChange={(v) => u({ content: { ...el.content, placeholder: v } })} />
        </Section>
      )}
      {el.type === "image" && (
        <Section title="Content">
          <ContentInput label="Image URL" value={String(el.content.src ?? "")}
            onChange={(v) => u({ content: { ...el.content, src: v } })} />
        </Section>
      )}

      {/* Style overrides */}
      <Section title="Styles">
        <StyleRow label="Color" prop="color" el={el} update={u} type="color" />
        <StyleRow label="Background" prop="backgroundColor" el={el} update={u} type="color" />
        <StyleRow label="Border Radius" prop="borderRadius" el={el} update={u} type="text" />
        <StyleRow label="Font Size" prop="fontSize" el={el} update={u} type="text" />
      </Section>

      {/* Z-order & actions */}
      <Section title="Layer">
        <div style={{ display: "flex", gap: 6 }}>
          <SmallBtn onClick={() => bringForward(el.id)}>↑ Forward</SmallBtn>
          <SmallBtn onClick={() => sendBackward(el.id)}>↓ Back</SmallBtn>
        </div>
      </Section>

      {/* Group */}
      <Section title="Group">
        <div style={{ display: "flex", gap: 6 }}>
          {selectedIds.length >= 2 && (
            <SmallBtn onClick={groupSelected} style={{ color: "#ab9ff2", borderColor: "#ab9ff2" }}>
              ⊞ Group ({selectedIds.length})
            </SmallBtn>
          )}
          {inGroup && (
            <SmallBtn onClick={ungroupSelected}>⊟ Ungroup</SmallBtn>
          )}
          {inGroup && (
            <div style={{ fontSize: 10, color: "#ab9ff2", marginTop: 4 }}>Grouped — drag moves all</div>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
          Shift+click to multi-select
        </div>
      </Section>

      {/* Actions */}
      <Section title="Actions">
        <div style={{ display: "flex", gap: 6 }}>
          <SmallBtn onClick={() => duplicateElement(el.id)}>⧉ Duplicate</SmallBtn>
          <SmallBtn
            onClick={() => removeElement(el.id)}
            style={{ color: "#f87171", borderColor: "#f87171" }}
          >
            ✕ Delete
          </SmallBtn>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10,
        color: "#555",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 8,
        paddingBottom: 4,
        borderBottom: "1px solid #2a2a2a",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StyleRow({
  label, prop, el, update, type,
}: {
  label: string;
  prop: string;
  el: { styles: Record<string, string> };
  update: (patch: { styles: Record<string, string> }) => void;
  type: "color" | "text";
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <label style={{ fontSize: 11, color: "#888", width: 80, flexShrink: 0 }}>{label}</label>
      <input
        type={type}
        value={el.styles[prop] ?? ""}
        onChange={(e) =>
          update({ styles: { ...el.styles, [prop]: e.target.value } })
        }
        style={{
          flex: 1,
          height: 26,
          backgroundColor: "#2a2a2a",
          border: "1px solid #3a3a3a",
          borderRadius: 5,
          color: "#e8e8e8",
          fontSize: 12,
          padding: type === "color" ? 2 : "0 6px",
          outline: "none",
          boxSizing: "border-box",
          cursor: type === "color" ? "pointer" : "text",
        }}
      />
    </div>
  );
}

function SmallBtn({
  children,
  onClick,
  style,
}: {
  children: React.ReactNode;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: 28,
        backgroundColor: "transparent",
        border: "1px solid #3a3a3a",
        borderRadius: 6,
        color: "#aaa",
        fontSize: 11,
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
