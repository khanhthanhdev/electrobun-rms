interface LoadingIndicatorProps {
  className?: string;
}

export const LoadingIndicator = ({
  className = "loading-center",
}: LoadingIndicatorProps): JSX.Element => (
  <div className={className}>
    <div className="spinner" />
  </div>
);
