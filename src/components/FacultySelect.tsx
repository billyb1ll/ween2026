import { SearchableSelect } from "./SearchableSelect";
import { FACULTIES } from "../lib/constants";

interface Faculty {
  value: string; // Stored as the code (e.g. "EG")
  primaryText: string;
  secondaryText: string;
  badge: string;
}

const FACULTY_OPTIONS: Faculty[] = FACULTIES.map((fac) => {
  return {
    value: fac.short,
    primaryText: fac.en,
    secondaryText: fac.th,
    badge: fac.short,
  };
});

export interface FacultySelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function FacultySelect({ value, onChange }: FacultySelectProps) {
  // Normalize incoming value: match by short code ("SC"), English name ("Faculty of Science"), or Thai name
  const matchedFac = FACULTIES.find(
    (f) =>
      f.short.toLowerCase() === (value || "").toLowerCase() ||
      f.en.toLowerCase() === (value || "").toLowerCase() ||
      f.th.toLowerCase() === (value || "").toLowerCase()
  );

  // Use matching short code if found, or raw value for custom entries
  const normalizedValue = matchedFac ? matchedFac.short : value;

  return (
    <SearchableSelect
      value={normalizedValue}
      onChange={(val) => {
        const found = FACULTIES.find((f) => f.short === val || f.en === val);
        onChange(found ? found.en : val);
      }}
      options={FACULTY_OPTIONS}
      placeholder="พิมพ์ค้นหาคณะ / Type to search..."
      searchPlaceholder="พิมพ์ค้นหาคณะ / Type to search..."
    />
  );
}
