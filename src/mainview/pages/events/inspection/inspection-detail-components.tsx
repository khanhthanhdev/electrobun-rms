import type {
  ChecklistItem,
  ChecklistSection,
  InspectionHistoryEntry,
  InspectionInputType,
} from "../../../shared/types/inspection";

interface ChecklistInputProps {
  currentValue: string | null;
  disabled: boolean;
  inputType: InspectionInputType;
  itemKey: string;
  onUpdate: (key: string, value: string | null) => Promise<void>;
  options?: ChecklistItem["options"];
}

export const ChecklistInput = ({
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

interface InspectionHeaderProps {
  eventCode: string;
  onNavigate: (path: string) => void;
  status: string;
  statusLabel: string;
  teamName: string | undefined;
  teamNumber: number;
}

export const InspectionHeader = ({
  eventCode,
  onNavigate,
  status,
  statusLabel,
  teamName,
  teamNumber,
}: InspectionHeaderProps): JSX.Element => {
  return (
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
        <span className={`inspection-pill inspection-pill--${status}`}>
          {statusLabel}
        </span>
      </div>

      <h1 className="app-heading" style={{ fontSize: "1.25rem", margin: 0 }}>
        Inspection Checklist
      </h1>

      <div className="inspection-detail-header" style={{ marginBottom: 0 }}>
        {/* Desktop */}
        <div className="inspection-desktop-header">
          <h2 className="app-heading" style={{ fontSize: "1rem", margin: 0 }}>
            {teamName ?? "Unknown"} — #{teamNumber}
          </h2>
        </div>

        {/* Mobile */}
        <div className="inspection-mobile-header">
          <div className="inspection-detail-row">
            <h2 className="app-heading" style={{ fontSize: "1rem", margin: 0 }}>
              {teamName ?? "Unknown"}
            </h2>
          </div>
          <div className="inspection-detail-row">
            <h2 className="app-heading" style={{ fontSize: "1rem", margin: 0 }}>
              #{teamNumber}
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
};

interface InspectionHeaderActionsProps {
  isSaving: boolean;
  onMarkInProgress: () => void;
  onToggleMissing: () => void;
  showMissing: boolean;
}

export const InspectionHeaderActions = ({
  isSaving,
  onMarkInProgress,
  onToggleMissing,
  showMissing,
}: InspectionHeaderActionsProps): JSX.Element => {
  return (
    <>
      <button
        className="inspection-btn-teal"
        disabled={isSaving}
        onClick={onMarkInProgress}
        type="button"
      >
        Mark In Progress
      </button>
      <button
        className="inspection-btn-teal"
        onClick={onToggleMissing}
        type="button"
      >
        {showMissing ? "Hide Missing" : "Highlight Missing"}
      </button>
    </>
  );
};

interface InspectionProgressProps {
  completed: number;
  total: number;
}

export const InspectionProgress = ({
  completed,
  total,
}: InspectionProgressProps): JSX.Element => (
  <p className="app-note" style={{ margin: "0rem 0 0rem 0" }}>
    Progress: {completed}/{total} required items
  </p>
);

interface InspectionCommentsProps {
  commentDraft: string;
  isSaving: boolean;
  onCommentChange: (value: string) => void;
  onSaveComment: () => void;
}

export const InspectionComments = ({
  commentDraft,
  isSaving,
  onCommentChange,
  onSaveComment,
}: InspectionCommentsProps): JSX.Element => (
  <section className="inspection-comments stack stack--compact">
    <h2 className="app-heading">General Comments</h2>
    <textarea
      onChange={(event) => {
        onCommentChange(event.currentTarget.value);
      }}
      placeholder="Comments or reason for incomplete..."
      value={commentDraft}
    />
    <div>
      <button
        className="outline"
        disabled={isSaving}
        onClick={onSaveComment}
        type="button"
      >
        Save Comment
      </button>
    </div>
  </section>
);

interface InspectionActionsProps {
  isSaving: boolean;
  onIncomplete: () => void;
  onPass: () => void;
}

export const InspectionActions = ({
  isSaving,
  onIncomplete,
  onPass,
}: InspectionActionsProps): JSX.Element => (
  <div className="inspection-actions">
    <button
      data-variant="danger"
      disabled={isSaving}
      onClick={onIncomplete}
      type="button"
    >
      Incomplete
    </button>
    <button
      className="inspection-pass-btn"
      disabled={isSaving}
      onClick={onPass}
      type="button"
    >
      Pass
    </button>
  </div>
);

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

interface InspectionHistoryProps {
  history: InspectionHistoryEntry[];
  isLoading: boolean;
}

export const InspectionHistory = ({
  history,
  isLoading,
}: InspectionHistoryProps): JSX.Element => (
  <section className="inspection-history stack stack--compact">
    <h2 className="app-heading">History</h2>
    {isLoading ? <p className="app-note">Loading history...</p> : null}
    {!isLoading && history.length === 0 ? (
      <p className="app-note">No history records yet.</p>
    ) : null}
    {!isLoading && history.length > 0 ? (
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
);

interface SectionGroup {
  items: ChecklistItem[];
  section: ChecklistSection;
}

interface InspectionChecklistProps {
  highlightMissing: boolean;
  isSaving: boolean;
  onUpdateItem: (key: string, value: string | null) => Promise<void>;
  responses: Record<string, string | undefined>;
  sectionGroups: SectionGroup[];
}

export const InspectionChecklist = ({
  highlightMissing,
  isSaving,
  onUpdateItem,
  responses,
  sectionGroups,
}: InspectionChecklistProps): JSX.Element => (
  <div className="inspection-table">
    {sectionGroups.map((group) => {
      const isGroupComplete = group.items.every(
        (item) => !item.required || responses[item.key] === "true"
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
                responses[item.key] !== "true";
              return (
                <div
                  className={`inspection-item ${isMissing ? "inspection-item--missing" : ""}`}
                  key={item.key}
                >
                  <div className="inspection-item-check">
                    <ChecklistInput
                      currentValue={responses[item.key] ?? null}
                      disabled={isSaving}
                      inputType={item.inputType}
                      itemKey={item.key}
                      onUpdate={onUpdateItem}
                      options={item.options}
                    />
                  </div>
                  <div className="inspection-item-label">
                    {item.label}
                    {item.required ? (
                      <span className="inspection-required">*</span>
                    ) : null}
                  </div>
                  <div className="inspection-item-rule">{item.ruleCode}</div>
                </div>
              );
            })}
          </div>
        </section>
      );
    })}
  </div>
);

interface InspectionErrorAlertProps {
  error?: string | null;
  statusError?: string | null;
}

export const InspectionErrorAlert = ({
  error,
  statusError,
}: InspectionErrorAlertProps): JSX.Element | null => {
  if (!(statusError || error)) {
    return null;
  }

  return (
    <>
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
    </>
  );
};
