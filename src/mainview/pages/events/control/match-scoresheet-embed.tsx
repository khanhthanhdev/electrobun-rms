import { useMatchScoresheet } from "../../../features/scoring/hooks/use-match-results";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import type { MatchType } from "../../../shared/types/scoring";
import { ScoresheetGrid } from "../results/match-scoresheet-page";

interface MatchScoresheetEmbedProps {
  eventCode: string;
  matchNumber: number;
  matchType: MatchType;
  token: string | null;
}

export const MatchScoresheetEmbed = ({
  eventCode,
  matchNumber,
  matchType,
  token,
}: MatchScoresheetEmbedProps): JSX.Element => {
  const { scoresheet, isLoading, error } = useMatchScoresheet(
    eventCode,
    matchType,
    matchNumber,
    token,
    true
  );

  if (error) {
    return (
      <p className="message-block" data-variant="danger" role="alert">
        {error}
      </p>
    );
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <ScoresheetGrid
      mobileView="all"
      scoresheet={scoresheet}
      showMobileSelector={false}
    />
  );
};
