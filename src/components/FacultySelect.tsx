import { SearchableSelect } from "./SearchableSelect";
import { THAI_FACULTIES } from "../lib/constants";

interface Faculty {
  value: string; // Stored as the code (e.g. "EG") per instructions
  primaryText: string;
  secondaryText: string;
  badge: string;
}

const EN_NAMES: Record<string, string> = {
  SI: "Medicine Siriraj Hospital",
  SC: "Science",
  RA: "Medicine Ramathibodi Hospital",
  DT: "Dentistry",
  MT: "Medical Technology",
  PH: "Public Health",
  NS: "Nursing",
  PT: "Physical Therapy",
  NR: "Ramathibodi School of Nursing",
  EG: "Engineering",
  EN: "Environment and Resource Studies",
  KA: "Kanchanaburi Campus",
  VS: "Veterinary Medicine",
  PI: "Doctors for Rural Areas Project",
  OT: "Occupational Therapy",
  NA: "Nakhon Sawan Campus",
  AM: "Amnat Charoen Campus",
  LA: "Liberal Arts",
  CRS: "Religious Studies",
  IC: "Mahidol University International College",
  ICT: "Information and Communication Technology",
  PO: "Sirindhorn School of Prosthetics and Orthotics",
  SS: "Sports Science and Technology",
  SH: "Social Sciences and Humanities",
  MS: "Music",
  RS: "Ratchasuda College",
  PY: "Pharmacy",
  TM: "Tropical Medicine",
};

// Dynamically parse THAI_FACULTIES from constants.ts into the generic options format
const FACULTY_OPTIONS: Faculty[] = THAI_FACULTIES.map((str) => {
  const match = str.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (match) {
    const nameTh = match[1].trim();
    const code = match[2].trim();
    const nameEn = EN_NAMES[code] || nameTh;
    return {
      value: code, // Value is the code (e.g. "EG")
      primaryText: nameEn,
      secondaryText: nameTh,
      badge: code,
    };
  }
  return {
    value: str.slice(0, 3).toUpperCase(),
    primaryText: str,
    secondaryText: str,
    badge: str.slice(0, 3).toUpperCase(),
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
