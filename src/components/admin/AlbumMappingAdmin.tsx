import { useState, useEffect } from "react";
import { Box, Button, VStack, Text, Flex, Spinner, Input, IconButton } from "@chakra-ui/react";
import { createImmichService } from "../../lib/immich";
import { useAlbumMappings } from "../../config/album-mapping";
import type { AlbumMapping } from "../../config/album-mapping";
import { supabase } from "../../lib/supabase";
import { toaster } from "../ui/toaster";
import { FiTrash2, FiPlus, FiSave } from "react-icons/fi";

const immich = createImmichService({ baseUrl: "/api/immich" });

export function AlbumMappingAdmin() {
  const { mappings, loading, refetch } = useAlbumMappings();
  const [localMappings, setLocalMappings] = useState<AlbumMapping[]>([]);
  const [immichAlbums, setImmichAlbums] = useState<{ id: string; albumName: string }[]>([]);
  const [fetchingAlbums, setFetchingAlbums] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      // eslint-disable-next-line
      setLocalMappings(mappings);
    }
  }, [mappings, loading]);

  useEffect(() => {
    const loadAlbums = async () => {
      try {
        const albums = await immich.albums.list();
        setImmichAlbums(albums);
      } catch (err) {
        console.error("Failed to load immich albums", err);
      } finally {
        setFetchingAlbums(false);
      }
    };
    loadAlbums();
  }, []);

  const handleAddRow = () => {
    setLocalMappings([
      ...localMappings,
      { key: `day${localMappings.length + 1}`, label: `Day ${localMappings.length + 1} - New Event`, immichAlbumId: "", immichAlbumName: "" }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setLocalMappings(localMappings.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof AlbumMapping, value: string) => {
    const updated = [...localMappings];
    updated[index][field] = value;
    setLocalMappings(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("system_config").upsert([
        {
          key: "immich_album_mapping",
          value: true,
          text_value: JSON.stringify(localMappings),
        }
      ]);

      if (error) throw error;
      
      toaster.create({ title: "Saved", description: "Album mappings updated successfully.", type: "success" });
      refetch();
    } catch (err) {
      console.error("Save error", err);
      toaster.create({ title: "Error", description: "Failed to save mappings.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || fetchingAlbums) return <Spinner color="var(--c-chocolate)" />;

  return (
    <Box bg="bg.surface" p={6} borderRadius="xl" border="1px solid" borderColor="border.subtle">
      <VStack align="stretch" gap={4}>
        <Flex justify="space-between" align="center">
          <Text fontWeight="700" color="accent.solid" fontSize="lg">Frontend Album Mappings</Text>
          <Button size="sm" onClick={handleSave} loading={saving} bg="var(--c-chocolate)" color="white" _hover={{ bg: "var(--c-ink)" }}>
            <Box as="span" mr={2}><FiSave /></Box> Save Configuration
          </Button>
        </Flex>
        
        <Text fontSize="sm" color="fg.muted">Map UI tabs (e.g. "Day 1") to actual albums stored in Immich.</Text>
        
        <VStack align="stretch" gap={3} mt={2}>
          {localMappings.map((m, i) => (
            <Flex key={i} gap={3} align="flex-end" p={3} border="1px solid" borderColor="border.subtle" borderRadius="md" bg="var(--c-white)">
              <Box flex={1}>
                <Text fontSize="xs" fontWeight="bold" mb={1} color="fg.muted">Internal Key (e.g. day1)</Text>
                <Input size="sm" value={m.key} onChange={(e) => handleChange(i, 'key', e.target.value)} />
              </Box>
              <Box flex={2}>
                <Text fontSize="xs" fontWeight="bold" mb={1} color="fg.muted">UI Label (e.g. Day 1 - Event)</Text>
                <Input size="sm" value={m.label} onChange={(e) => handleChange(i, 'label', e.target.value)} />
              </Box>
              <Box flex={2}>
                <Text fontSize="xs" fontWeight="bold" mb={1} color="fg.muted">Immich Album Link</Text>
                <Box border="1px solid" borderColor="border.subtle" borderRadius="md" overflow="hidden" w="100%" p={1}>
                  <select 
                    style={{ width: "100%", padding: "4px", backgroundColor: "transparent", outline: "none" }}
                    aria-label="Select Immich Album"
                    title="Select Immich Album"
                    value={m.immichAlbumId || ""} 
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedAlbum = immichAlbums.find(a => a.id === selectedId);
                      const updated = [...localMappings];
                      updated[i].immichAlbumId = selectedId;
                      updated[i].immichAlbumName = selectedAlbum?.albumName || "";
                      setLocalMappings(updated);
                    }}
                  >
                    <option value="">-- Select Immich Album --</option>
                    {immichAlbums.map(album => (
                      <option key={album.id} value={album.id}>{album.albumName}</option>
                    ))}
                  </select>
                </Box>
              </Box>
              <IconButton aria-label="Remove" variant="ghost" color="red.500" onClick={() => handleRemoveRow(i)}>
                <FiTrash2 />
              </IconButton>
            </Flex>
          ))}
          
          <Button mt={2} variant="outline" color="var(--c-chocolate)" borderColor="var(--c-chocolate)" onClick={handleAddRow} alignSelf="flex-start">
            <Box as="span" mr={2}><FiPlus /></Box> Add New Mapping
          </Button>
        </VStack>
      </VStack>
    </Box>
  );
}
