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
  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={FACULTY_OPTIONS}
      placeholder="พิมพ์ค้นหาคณะ / Type to search..."
      searchPlaceholder="พิมพ์ค้นหาคณะ / Type to search..."
    />
  );
}
