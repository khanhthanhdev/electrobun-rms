import { useMemo, useState } from "react";
import "../../../app/styles/components/inspection.css";
import { useInspectionDetail } from "../../../features/inspection/hooks/use-inspection-detail";
import { useInspectionRealtime } from "../../../features/inspection/hooks/use-inspection-realtime";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import type {
  ChecklistDefinition,
  ChecklistItem,
  ChecklistSection,
} from "../../../shared/types/inspection";
import {
  InspectionActions,
  InspectionChecklist,
  InspectionComments,
  InspectionErrorAlert,
  InspectionHeader,
  InspectionHeaderActions,
  InspectionHistory,
  InspectionProgress,
} from "./inspection-detail-components";

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

export const InspectionDetailPage = ({
  eventCode,
  onNavigate,
  teamNumber,
  token,
}: InspectionDetailPageProps): JSX.Element => {
  useInspectionRealtime(eventCode, token);

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
        <InspectionHeader
          eventCode={eventCode}
          onNavigate={onNavigate}
          status={data.inspection.status}
          statusLabel={data.inspection.statusLabel ?? ""}
          teamName={data.team.teamName ?? undefined}
          teamNumber={teamNumber}
        />

        <div className="inspection-desktop-header-actions">
          <InspectionHeaderActions
            isSaving={isSaving}
            onMarkInProgress={() => updateStatus("IN_PROGRESS")}
            onToggleMissing={() => setHighlightMissing((prev) => !prev)}
            showMissing={highlightMissing}
          />
        </div>

        <InspectionProgress
          completed={data.progress.completedRequired}
          total={data.progress.totalRequired}
        />

        <InspectionErrorAlert error={error} statusError={statusError} />

        <InspectionChecklist
          highlightMissing={highlightMissing}
          isSaving={isSaving}
          onUpdateItem={updateItem}
          responses={Object.fromEntries(
            Object.entries(data.responses).map(([key, value]) => [
              key,
              value ?? undefined,
            ])
          )}
          sectionGroups={sectionGroups}
        />

        <InspectionComments
          commentDraft={commentDraft}
          isSaving={isSaving}
          onCommentChange={setCommentDraft}
          onSaveComment={handleSaveComment}
        />

        <InspectionActions
          isSaving={isSaving}
          onIncomplete={() => updateStatus("INCOMPLETE")}
          onPass={() => updateStatus("PASSED")}
        />

        <InspectionHistory history={history} isLoading={isHistoryLoading} />
      </section>
    </main>
  );
};
