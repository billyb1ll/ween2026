import { useState, useRef } from "react";
import { Box, Button, VStack, Text, Input, Flex, Spinner } from "@chakra-ui/react";
import { createImmichService } from "../../lib/immich";
import { useAlbumMappings } from "../../config/album-mapping";
import { toaster } from "../ui/toaster";

const immich = createImmichService({ baseUrl: "/api/immich" });

export function MediaUploader() {
  const { mappings, loading } = useAlbumMappings();
  const [selectedAlbum, setSelectedAlbum] = useState<string>("day1");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | File[]) => {
    if (fileList.length === 0) return;
    setUploading(true);
    setProgress(0);
    
    // Convert to array
    const files = Array.from(fileList);
    
    try {
      // 1. Find the target album in Immich
      const mapping = mappings.find(m => m.key === selectedAlbum);
      let album = null;
      if (mapping?.immichAlbumId) {
        album = await immich.albums.getById(mapping.immichAlbumId);
      } else if (mapping?.immichAlbumName) {
        album = await immich.albums.findByName(mapping.immichAlbumName);
      } else {
        album = await immich.albums.findByName(selectedAlbum);
      }
      
      if (!album) {
        toaster.create({ title: "Album not found", description: `Could not find album ${mapping?.label || selectedAlbum}`, type: "error" });
        setUploading(false);
        return;
      }

      // 2. Upload assets concurrently (Batching)
      const assetIds: string[] = [];
      const CONCURRENCY = 5;
      
      for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        
        const uploadPromises = batch.map(async (file) => {
          try {
            const res = await immich.assets.upload(file);
            return res?.id;
          } catch (err: unknown) {
            // Ignore 409 Conflict if asset already exists
            const apiErr = err as { statusCode?: number };
            if (apiErr?.statusCode === 409) {
              return null; // Already exists
            }
            throw err;
          }
        });
        
        const results = await Promise.all(uploadPromises);
        assetIds.push(...results.filter((id): id is string => Boolean(id)));
        
        setProgress(Math.round(((i + batch.length) / files.length) * 100));
      }

      // 3. Add to album
      if (assetIds.length > 0) {
        await immich.albums.addAssets({ albumIds: [album.id], assetIds });
        toaster.create({ title: "Upload Complete", description: `Successfully added ${assetIds.length} assets to ${mapping?.label || album.albumName}.`, type: "success" });
      } else {
        toaster.create({ title: "Upload Skipped", description: `No new photos added (all duplicates).`, type: "info" });
      }
    } catch (err) {
      console.error("Upload error:", err);
      toaster.create({ title: "Upload Failed", description: "Failed to upload media to Immich.", type: "error" });
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  if (loading) return <Spinner color="var(--c-chocolate)" />;

  return (
    <Box bg="bg.surface" p={6} borderRadius="xl" border="1px solid" borderColor="border.subtle">
      <VStack align="stretch" gap={4}>
        <Text fontWeight="700" color="accent.solid" fontSize="lg">Immich Direct Upload</Text>
        
        <Flex gap={2} mb={2} wrap="wrap">
          {mappings.map(m => (
            <Button
              key={m.key}
              variant={selectedAlbum === m.key ? "solid" : "outline"}
              bg={selectedAlbum === m.key ? "var(--c-chocolate)" : "transparent"}
              color={selectedAlbum === m.key ? "white" : "var(--c-chocolate)"}
              onClick={() => setSelectedAlbum(m.key)}
              size="sm"
              borderRadius="full"
            >
              {m.label}
            </Button>
          ))}
        </Flex>

        <Box
          border="2px dashed"
          borderColor={dragActive ? "var(--c-chocolate)" : "border.subtle"}
          bg={dragActive ? "color-mix(in srgb, var(--c-chocolate) 5%, transparent)" : "transparent"}
          borderRadius="xl"
          p={10}
          textAlign="center"
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
        >
          {uploading ? (
            <VStack>
              <Spinner color="var(--c-chocolate)" />
              <Text color="fg.muted">Uploading & adding to album... {progress}%</Text>
            </VStack>
          ) : (
            <VStack gap={3}>
              <Text color="fg.muted">Drag & drop photos here, or select files/folders</Text>
              <Flex gap={4}>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" color="var(--c-chocolate)" borderColor="var(--c-chocolate)">
                  Select Files
                </Button>
                <Button onClick={() => folderInputRef.current?.click()} variant="solid" bg="var(--c-chocolate)" color="white">
                  Select Folder
                </Button>
              </Flex>
              <Input
                type="file"
                multiple
                accept="image/*,video/*"
                display="none"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files) handleFiles(e.target.files);
                }}
              />
              <Input
                type="file"
                multiple
                accept="image/*,video/*"
                display="none"
                // @ts-expect-error - React typings miss webkitdirectory
                webkitdirectory=""
                directory=""
                ref={folderInputRef}
                onChange={(e) => {
                  if (e.target.files) handleFiles(e.target.files);
                }}
              />
            </VStack>
          )}
        </Box>
      </VStack>
    </Box>
  );
}
