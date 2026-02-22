import { useMemo, useState } from "react";
import "../../app/styles/components/inspection.css";
import { useInspectionDetail } from "../../features/inspection/hooks/use-inspection-detail";
import { LoadingIndicator } from "../../shared/components/loading-indicator";
import type {
  ChecklistDefinition,
  ChecklistItem,
  ChecklistSection,
  InspectionHistoryEntry,
  InspectionInputType,
} from "../../shared/types/inspection";

interface InspectionDetailPageProps {
  eventCode: string;
  onNavigate: (path: string) => void;
  teamNumber: number;
  token: string | null;
}

interface SectionGroup {
  items: ChecklistItem[];
  section: ChecklistSection;
}

const buildSectionGroups = (
  definition: ChecklistDefinition
): SectionGroup[] => {
  const itemsBySection = new Map<string, ChecklistItem[]>();
  for (const item of definition.items) {
    const existing = itemsBySection.get(item.sectionId);
    if (existing) {
      existing.push(item);
    } else {
      itemsBySection.set(item.sectionId, [item]);
    }
  }
  return [...definition.sections]
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      section,
      items: itemsBySection.get(section.id) ?? [],
    }));
};

interface ChecklistInputProps {
  currentValue: string | null;
  disabled: boolean;
  inputType: InspectionInputType;
  itemKey: string;
  onUpdate: (key: string, value: string | null) => Promise<void>;
  options?: ChecklistItem["options"];
}

const ChecklistInput = ({
  currentValue,
  disabled,
  inputType,
  itemKey,
  onUpdate,
  options,
}: ChecklistInputProps): JSX.Element => {
  if (inputType === "CHECKBOX") {
    return (
      <input
        checked={currentValue === "true"}
        disabled={disabled}
        onChange={(event) => {
          onUpdate(itemKey, event.currentTarget.checked ? "true" : null);
        }}
        type="checkbox"
      />
    );
  }

  if (inputType === "SELECT") {
    return (
      <select
        disabled={disabled}
        onChange={(event) => {
          const val = event.currentTarget.value;
          onUpdate(itemKey, val === "" ? null : val);
        }}
        value={currentValue ?? ""}
      >
        <option value="">—</option>
        {options?.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      defaultValue={currentValue ?? ""}
      disabled={disabled}
      onBlur={(event) => {
        const val = event.currentTarget.value.trim();
        onUpdate(itemKey, val === "" ? null : val);
      }}
      type="number"
    />
  );
};

const ACTION_LABELS: Record<string, string> = {
  LEAD_OVERRIDE: "Lead Inspector Override",
  STATUS_CHANGE: "Status Change",
};

const STATUS_DISPLAY: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  INCOMPLETE: "Incomplete",
  NOT_STARTED: "Not Started",
  PASSED: "Passed",
};

const formatHistoryAction = (entry: InspectionHistoryEntry): string => {
  const action = ACTION_LABELS[entry.action] ?? entry.action;
  if (entry.oldStatus && entry.newStatus) {
    const from = STATUS_DISPLAY[entry.oldStatus] ?? entry.oldStatus;
    const to = STATUS_DISPLAY[entry.newStatus] ?? entry.newStatus;
    return `${action}: ${from} → ${to}`;
  }
  return action;
};

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleString();
};

export const InspectionDetailPage = ({
  eventCode,
  onNavigate,
  teamNumber,
  token,
}: InspectionDetailPageProps): JSX.Element => {
  const {
    data,
    error,
    history,
    isHistoryLoading,
    isLoading,
    isSaving,
    saveComment,
    statusError,
    updateItem,
    updateStatus,
  } = useInspectionDetail(eventCode, teamNumber, token);

  const [commentDraft, setCommentDraft] = useState("");
  const [commentInitialized, setCommentInitialized] = useState(false);
  const [highlightMissing, setHighlightMissing] = useState(false);

  if (data && !commentInitialized) {
    setCommentDraft(data.inspection.comment ?? "");
    setCommentInitialized(true);
  }

  const sectionGroups = useMemo(() => {
    if (!data) {
      return [];
    }
    return buildSectionGroups(data.checklist);
  }, [data]);

  if (isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {error}
          </p>
          <a
            className="app-link-inline"
            href={`/event/${eventCode}/inspection`}
          >
            Back to Team Select
          </a>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page-shell page-shell--center">
        <p>No inspection data available.</p>
      </main>
    );
  }

  const handleSaveComment = (): void => {
    saveComment(commentDraft);
  };

  return (
    <main className="page-shell page-shell--top">
      <section className="card surface-card surface-card--xlarge stack">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0rem",
            marginBottom: "0rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <a
              className="app-link-inline"
              href={`/event/${eventCode}/inspection`}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(`/event/${eventCode}/inspection`);
              }}
            >
              &lt;&lt; Back to Team Select
            </a>
            <span
              className={`inspection-pill inspection-pill--${data.inspection.status}`}
            >
              {data.inspection.statusLabel}
            </span>
          </div>

          <h1
            className="app-heading"
            style={{ fontSize: "1.25rem", margin: 0 }}
          >
            Inspection Checklist
          </h1>

          <div className="inspection-detail-header" style={{ marginBottom: 0 }}>
            {/* Desktop */}
            <div className="inspection-desktop-header">
              <h2
                className="app-heading"
                style={{ fontSize: "1rem", margin: 0 }}
              >
                {data.team.teamName ?? "Unknown"} — #{teamNumber}
              </h2>
              <div className="inspection-desktop-header-actions">
                <button
                  className="inspection-btn-teal"
                  disabled={isSaving}
                  onClick={() => updateStatus("IN_PROGRESS")}
                  type="button"
                >
                  Mark In Progress
                </button>
                <button
                  className="inspection-btn-teal"
                  onClick={() => setHighlightMissing((prev) => !prev)}
                  type="button"
                >
                  {highlightMissing ? "Hide Missing" : "Highlight Missing"}
                </button>
              </div>
            </div>

            {/* Mobile */}
            <div className="inspection-mobile-header">
              <div className="inspection-detail-row">
                <h2
                  className="app-heading"
                  style={{ fontSize: "1rem", margin: 0 }}
                >
                  {data.team.teamName ?? "Unknown"}
                </h2>
                <button
                  className="inspection-btn-teal"
                  disabled={isSaving}
                  onClick={() => updateStatus("IN_PROGRESS")}
                  type="button"
                >
                  Mark In Progress
                </button>
              </div>
              <div className="inspection-detail-row">
                <h2
                  className="app-heading"
                  style={{ fontSize: "1rem", margin: 0 }}
                >
                  #{teamNumber}
                </h2>
                <button
                  className="inspection-btn-teal"
                  onClick={() => setHighlightMissing((prev) => !prev)}
                  type="button"
                >
                  {highlightMissing ? "Hide Missing" : "Highlight Missing"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="app-note" style={{ margin: "0rem 0 0rem 0" }}>
          Progress: {data.progress.completedRequired}/
          {data.progress.totalRequired} required items
        </p>

        {statusError ? (
          <p className="message-block" data-variant="danger" role="alert">
            {statusError}
          </p>
        ) : null}

        {error ? (
          <p className="message-block" data-variant="danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="inspection-table">
          {sectionGroups.map((group) => {
            const isGroupComplete = group.items.every(
              (item) => !item.required || data.responses[item.key] === "true"
            );

            return (
              <section className="inspection-section" key={group.section.id}>
                <div className="inspection-section-title">
                  <div className="inspection-section-title-check">
                    {isGroupComplete ? "✓" : ""}
                  </div>
                  <div className="inspection-section-title-text">
                    {group.section.label}
                  </div>
                  <div className="inspection-section-title-rule">Rule #</div>
                </div>
                <div className="inspection-items">
                  {group.items.map((item) => {
                    const isMissing =
                      highlightMissing &&
                      item.required &&
                      data.responses[item.key] !== "true";
                    return (
                      <div
                        className={`inspection-item ${isMissing ? "inspection-item--missing" : ""}`}
                        key={item.key}
                      >
                        <div className="inspection-item-check">
                          <ChecklistInput
                            currentValue={data.responses[item.key] ?? null}
                            disabled={isSaving}
                            inputType={item.inputType}
                            itemKey={item.key}
                            onUpdate={updateItem}
                            options={item.options}
                          />
                        </div>
                        <div className="inspection-item-label">
                          {item.label}
                          {item.required ? (
                            <span className="inspection-required">*</span>
                          ) : null}
                        </div>
                        <div className="inspection-item-rule">
                          {item.ruleCode}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <section className="inspection-comments stack stack--compact">
          <h2 className="app-heading">General Comments</h2>
          <textarea
            onChange={(event) => {
              setCommentDraft(event.currentTarget.value);
            }}
            placeholder="Comments or reason for incomplete..."
            value={commentDraft}
          />
          <div>
            <button
              className="outline"
              disabled={isSaving}
              onClick={handleSaveComment}
              type="button"
            >
              Save Comment
            </button>
          </div>
        </section>

        <div className="inspection-actions">
          <button
            data-variant="danger"
            disabled={isSaving}
            onClick={() => {
              updateStatus("INCOMPLETE");
            }}
            type="button"
          >
            Incomplete
          </button>
          <button
            className="inspection-pass-btn"
            disabled={isSaving}
            onClick={() => {
              updateStatus("PASSED");
            }}
            type="button"
          >
            Pass
          </button>
        </div>

        <section className="inspection-history stack stack--compact">
          <h2 className="app-heading">History</h2>
          {isHistoryLoading ? (
            <p className="app-note">Loading history...</p>
          ) : null}
          {!isHistoryLoading && history.length === 0 ? (
            <p className="app-note">No history records yet.</p>
          ) : null}
          {!isHistoryLoading && history.length > 0 ? (
            <div className="inspection-history-list">
              {history.map((entry) => (
                <div className="inspection-history-entry" key={entry.id}>
                  <div className="inspection-history-action">
                    {entry.isOverride ? (
                      <span className="inspection-pill inspection-pill--override">
                        Override
                      </span>
                    ) : null}
                    {formatHistoryAction(entry)}
                  </div>
                  <div className="inspection-history-meta">
                    <span>by {entry.changedBy}</span>
                    <span>{formatDateTime(entry.changedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
};
