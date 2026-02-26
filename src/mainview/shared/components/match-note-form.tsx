import { useEffect, useRef, useState } from "react";

export interface MatchNoteFormData {
  blueTeamName: string;
  blueTeamNumber: string;
  detail: string;
  matchId: string;
  redTeamName: string;
  redTeamNumber: string;
  summary: string;
  tags: {
    red: boolean;
    blue: boolean;
  };
}

interface MatchNoteFormProps {
  blueTeamName: string;
  blueTeamNumber: string;
  matchId: string;
  onCancel: () => void;
  onSave: (data: MatchNoteFormData) => void;
  open: boolean;
  redTeamName: string;
  redTeamNumber: string;
}

export const MatchNoteForm = ({
  open,
  matchId,
  redTeamNumber,
  redTeamName,
  blueTeamNumber,
  blueTeamName,
  onCancel,
  onSave,
}: MatchNoteFormProps): JSX.Element => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [tags, setTags] = useState({ red: false, blue: false });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const resetForm = () => {
    setSummary("");
    setDetail("");
    setTags({ red: false, blue: false });
  };

  const handleSave = () => {
    onSave({
      matchId,
      redTeamNumber,
      redTeamName,
      blueTeamNumber,
      blueTeamName,
      summary,
      detail,
      tags,
    });
    resetForm();
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  return (
    <dialog
      onCancel={handleCancel}
      ref={dialogRef}
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-medium)",
        padding: 0,
        width: "min(28rem, 90vw)",
        background: "var(--card)",
        color: "var(--foreground)",
        boxShadow: "0 8px 30px rgba(0,0,0,.25)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1.1rem",
            fontWeight: "var(--font-bold)" as React.CSSProperties["fontWeight"],
          }}
        >
          Match Note
        </h2>
        <button
          aria-label="Close"
          onClick={handleCancel}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.25rem",
            color: "var(--muted-foreground)",
            lineHeight: 1,
            padding: "0.25rem",
          }}
          type="button"
        >
          ✕ Close
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "1rem" }}>
        {/* Match Info */}
        <div
          style={{
            background: "var(--faint)",
            borderRadius: "var(--radius-small)",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            border: "1px solid var(--muted)",
          }}
        >
          <div style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            Match:{" "}
            <span
              style={{
                fontWeight:
                  "var(--font-bold)" as React.CSSProperties["fontWeight"],
              }}
            >
              {matchId}
            </span>
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted-foreground)",
                }}
              >
                Red
              </div>
              <div
                style={{
                  fontWeight:
                    "var(--font-bold)" as React.CSSProperties["fontWeight"],
                  color: "#dc2626",
                }}
              >
                {redTeamNumber} {redTeamName}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted-foreground)",
                }}
              >
                Blue
              </div>
              <div
                style={{
                  fontWeight:
                    "var(--font-bold)" as React.CSSProperties["fontWeight"],
                  color: "#0284c7",
                }}
              >
                {blueTeamNumber} {blueTeamName}
              </div>
            </div>
          </div>
        </div>

        {/* General/Summary */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label
            htmlFor="note-summary"
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight:
                "var(--font-medium)" as React.CSSProperties["fontWeight"],
              marginBottom: "0.35rem",
            }}
          >
            General/Summary
          </label>
          <input
            id="note-summary"
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief summary of the note"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-small)",
              background: "var(--background)",
              color: "var(--foreground)",
              fontSize: "0.85rem",
              boxSizing: "border-box",
            }}
            type="text"
            value={summary}
          />
        </div>

        {/* Detail */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label
            htmlFor="note-detail"
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight:
                "var(--font-medium)" as React.CSSProperties["fontWeight"],
              marginBottom: "0.35rem",
            }}
          >
            Detail
          </label>
          <textarea
            id="note-detail"
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Detailed description"
            rows={4}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-small)",
              background: "var(--background)",
              color: "var(--foreground)",
              fontSize: "0.85rem",
              resize: "vertical",
              boxSizing: "border-box",
            }}
            value={detail}
          />
        </div>

        {/* Tags */}
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend
            style={{
              fontSize: "0.85rem",
              fontWeight:
                "var(--font-medium)" as React.CSSProperties["fontWeight"],
              marginBottom: "0.35rem",
            }}
          >
            Tags
          </legend>
          <div style={{ display: "flex", gap: "1.25rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              <input
                checked={tags.red}
                onChange={(e) => setTags({ ...tags, red: e.target.checked })}
                type="checkbox"
              />
              <span style={{ color: "#dc2626" }}>Red Team</span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              <input
                checked={tags.blue}
                onChange={(e) => setTags({ ...tags, blue: e.target.checked })}
                type="checkbox"
              />
              <span style={{ color: "#0284c7" }}>Blue Team</span>
            </label>
          </div>
        </fieldset>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.5rem",
          padding: "0.75rem 1rem",
          borderTop: "1px solid var(--border)",
        }}
      >
        <button className="hr-btn" onClick={handleCancel} type="button">
          Cancel
        </button>
        <button
          className="hr-btn"
          onClick={handleSave}
          style={{
            background: "#2563eb",
            color: "#fff",
            borderColor: "#2563eb",
          }}
          type="button"
        >
          Save
        </button>
      </div>
    </dialog>
  );
};
