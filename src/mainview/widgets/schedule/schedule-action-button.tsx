import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

type ScheduleActionVariant = "neutral" | "warning" | "primary" | "muted";

interface ScheduleActionButtonProps {
  children: ReactNode;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  variant?: ScheduleActionVariant;
}

const BUTTON_BASE_STYLE: CSSProperties = {
  border: "none",
};

const BUTTON_VARIANT_STYLE: Record<ScheduleActionVariant, CSSProperties> = {
  neutral: {
    backgroundColor: "#6c757d",
    color: "white",
  },
  warning: {
    backgroundColor: "#ffc107",
    color: "black",
  },
  primary: {
    backgroundColor: "#0d6efd",
    color: "white",
  },
  muted: {
    backgroundColor: "#6c757d",
    color: "white",
  },
};

export const ScheduleActionButton = ({
  children,
  disabled = false,
  onClick,
  type = "button",
  variant = "neutral",
}: ScheduleActionButtonProps): JSX.Element => (
  <button
    disabled={disabled}
    onClick={onClick}
    style={{
      ...BUTTON_BASE_STYLE,
      ...BUTTON_VARIANT_STYLE[variant],
    }}
    type={type}
  >
    {children}
  </button>
);
