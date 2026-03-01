import { LoadingIndicator as LoadingIndicatorBase } from "@/shared/components/loading-indicator";

interface LoadingIndicatorProps {
  className?: string;
}

export const LoadingIndicator = ({
  className = "loading-center",
}: LoadingIndicatorProps): JSX.Element => (
  <LoadingIndicatorBase className={className} />
);
