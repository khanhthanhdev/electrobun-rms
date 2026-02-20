interface LoadingIndicatorProps {
  className?: string;
}

export const LoadingIndicator = ({
  className = "loading-center",
}: LoadingIndicatorProps): JSX.Element => (
  <output aria-live="polite" className={className}>
    Loading...
  </output>
);
