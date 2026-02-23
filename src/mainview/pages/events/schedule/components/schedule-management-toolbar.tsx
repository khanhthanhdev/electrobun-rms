import { ScheduleActionButton } from "./schedule-action-button";

interface ScheduleManagementToolbarProps {
  hasMatches: boolean;
  isActive: boolean;
  isClearing: boolean;
  isGenerating: boolean;
  isUpdatingActivation: boolean;
  onClear: () => void;
  onGenerate: () => void;
  onToggleActivation: () => void;
}

const getGenerateButtonLabel = (
  isGenerating: boolean,
  hasMatches: boolean
): string => {
  if (isGenerating) {
    return "Generating...";
  }

  if (hasMatches) {
    return "Regenerate";
  }

  return "Generate";
};

const getActivationButtonLabel = (
  isUpdatingActivation: boolean,
  isActive: boolean
): string => {
  if (isUpdatingActivation) {
    return "Updating...";
  }

  return isActive ? "Deactivate" : "Activate";
};

export const ScheduleManagementToolbar = ({
  hasMatches,
  isActive,
  isClearing,
  isGenerating,
  isUpdatingActivation,
  onClear,
  onGenerate,
  onToggleActivation,
}: ScheduleManagementToolbarProps): JSX.Element => (
  <>
    <ScheduleActionButton
      disabled={isGenerating}
      onClick={onGenerate}
      variant="neutral"
    >
      {getGenerateButtonLabel(isGenerating, hasMatches)}
    </ScheduleActionButton>
    <ScheduleActionButton
      disabled={isClearing || !hasMatches}
      onClick={onClear}
      variant="warning"
    >
      {isClearing ? "Clearing..." : "Clear All Matches"}
    </ScheduleActionButton>
    <ScheduleActionButton
      disabled={isUpdatingActivation || !(hasMatches || isActive)}
      onClick={onToggleActivation}
      variant="primary"
    >
      {getActivationButtonLabel(isUpdatingActivation, isActive)}
    </ScheduleActionButton>
  </>
);
