interface DisplayScoreLabelProps {
  children: React.ReactNode;
  className?: string;
}

export const DisplayScoreLabel = ({
  children,
  className = "",
}: DisplayScoreLabelProps): JSX.Element => (
  <span className={`display-score-label ${className}`.trim()}>{children}</span>
);
