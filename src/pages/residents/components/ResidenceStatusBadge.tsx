import type { ResidenceStatus } from "@/lib/api/residents.api";
import { i18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";

export const RESIDENCE_STATUS_LABELS: Record<ResidenceStatus, string> = {
  permanent: i18n.__("Permanent", "quan-li-dan-cu"),
  temporary: i18n.__("Temporary resident", "quan-li-dan-cu"),
  absent: i18n.__("Temporarily absent", "quan-li-dan-cu"),
  moved: i18n.__("Moved away", "quan-li-dan-cu"),
  unknown: i18n.__("Unknown", "quan-li-dan-cu"),
};

const VARIANTS = {
  permanent: "dimmed",
  temporary: "primary-soft",
  absent: "destructive-outline",
  moved: "dimmed",
  unknown: "dimmed",
} as const;

export default function ResidenceStatusBadge({
  status,
}: {
  status: ResidenceStatus;
}) {
  return (
    <Badge variant={VARIANTS[status]}>{RESIDENCE_STATUS_LABELS[status]}</Badge>
  );
}
