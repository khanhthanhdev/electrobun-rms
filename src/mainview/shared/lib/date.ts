import { formatDate as formatDateBase } from "@/shared/utils/date";

export const formatDate = (timestamp: number): string =>
  formatDateBase(timestamp);
