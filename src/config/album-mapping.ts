import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface AlbumMapping {
  key: string;
  label: string;
  immichAlbumId?: string; // Stable UUID to prevent name collision bugs
  immichAlbumName?: string; // Legacy field for exact name search fallback
}

// Default fallback maps UI tabs to their actual Immich Album names
export const DEFAULT_ALBUM_MAPPINGS: AlbumMapping[] = [
  {
    key: "day1",
    label: "Day 1 - Opening Ceremony",
    immichAlbumName: "day-1",
  },
  {
    key: "day2",
    label: "Day 2 - Activities",
    immichAlbumName: "day-2",
  },
  {
    key: "day3",
    label: "Day 3 - Closing",
    immichAlbumName: "day-3",
  },
];

export function useAlbumMappings() {
  const [mappings, setMappings] = useState<AlbumMapping[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMappings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_config")
        .select("text_value")
        .eq("key", "immich_album_mapping")
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
      if (data && data.text_value) {
        setMappings(JSON.parse(data.text_value) as AlbumMapping[]);
      } else {
        setMappings(DEFAULT_ALBUM_MAPPINGS);
      }
    } catch (err) {
      console.error("Failed to load album mappings", err);
      setMappings(DEFAULT_ALBUM_MAPPINGS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    fetchMappings();
  }, []);

  return { mappings, loading, refetch: fetchMappings };
}
