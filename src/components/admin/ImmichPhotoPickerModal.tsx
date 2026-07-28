import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  Spinner,
  Button,
  Dialog,
  HStack,
  IconButton,
  Portal,
  Badge,
  SimpleGrid,
} from "@chakra-ui/react";
import { immich } from "../../lib/immich";
import { FiX, FiChevronLeft, FiCheck } from "react-icons/fi";
import type { ImmichAlbum, ImmichAsset } from "../../lib/immich";

interface ImmichPhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMultiple: (urls: string[], mode?: "append" | "replace") => void;
  currentUrls?: string[];
}

interface AssetItemCardProps {
  asset: ImmichAsset;
  isSelected: boolean;
  isSaved: boolean;
  onToggle: (asset: ImmichAsset) => void;
}

const AssetItemCard = React.memo(function AssetItemCard({
  asset,
  isSelected,
  isSaved,
  onToggle,
}: AssetItemCardProps) {
  const thumbnailUrl = useMemo(
    () => immich.assets.thumbnailUrl(asset.id, "thumbnail"),
    [asset.id]
  );

  return (
    <Box
      position="relative"
      borderRadius="lg"
      overflow="hidden"
      aspectRatio={1}
      cursor="pointer"
      border="3px solid"
      borderColor={isSelected ? "brand.solid" : "transparent"}
      onClick={() => onToggle(asset)}
      transition="all 0.15s var(--ease-out-quart)"
      _hover={{
        transform: "scale(0.97)",
        borderColor: isSelected ? "brand.solid" : "border.muted",
      }}
    >
      <img
        src={thumbnailUrl}
        alt="Immich photo"
        style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }}
        loading="lazy"
        decoding="async"
      />
      {/* Overlay on hover and when selected */}
      <Flex
        position="absolute"
        inset={0}
        bg={isSelected ? "rgba(73,98,104,0.45)" : "rgba(0,0,0,0)"}
        transition="all 0.15s"
        align="center"
        justify="center"
      >
        {isSelected && (
          <Flex
            w="36px"
            h="36px"
            bg="brand.solid"
            borderRadius="full"
            align="center"
            justify="center"
            color="white"
            boxShadow="0 2px 12px rgba(0,0,0,0.25)"
          >
            <FiCheck size={20} />
          </Flex>
        )}
      </Flex>
      {/* Already saved indicator */}
      {isSaved && !isSelected && (
        <Box
          position="absolute"
          top={1.5}
          right={1.5}
          bg="rgba(0,0,0,0.55)"
          color="white"
          borderRadius="full"
          px={2}
          py={0.5}
          fontSize="9px"
          fontWeight="700"
          letterSpacing="0.04em"
        >
          SAVED
        </Box>
      )}
    </Box>
  );
});

export const ImmichPhotoPickerModal = ({
  isOpen,
  onClose,
  onSelectMultiple,
  currentUrls = [],
}: ImmichPhotoPickerModalProps) => {
  const [albums, setAlbums] = useState<ImmichAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<ImmichAlbum | null>(null);
  const [assets, setAssets] = useState<ImmichAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // O(1) set lookup for currently saved featured photos
  const savedAssetIdSet = useMemo(() => {
    const set = new Set<string>();
    currentUrls.forEach((url) => {
      const match = url.match(/\/api\/assets\/([a-f0-9-]+)/i);
      if (match) set.add(match[1]);
    });
    return set;
  }, [currentUrls]);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await immich.albums.list();
      setAlbums(data);
    } catch (err) {
      console.error("Failed to load immich albums:", err);
      setError("Failed to load albums from Immich.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !selectedAlbum) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAlbums();
    }
    if (!isOpen) {
      // Reset state on close
      setSelectedIds(new Set());
      setSelectedAlbum(null);
      setAssets([]);
    }
  }, [isOpen, selectedAlbum, loadAlbums]);

  const loadAssets = async (album: ImmichAlbum) => {
    setSelectedAlbum(album);
    setLoading(true);
    setError(null);
    try {
      const data = await immich.albums.getAssets(album.id);
      setAssets(data);
      // Pre-select photos that are already in currentUrls
      const preSelected = new Set<string>();
      data.forEach((asset) => {
        if (savedAssetIdSet.has(asset.id)) {
          preSelected.add(asset.id);
        }
      });
      setSelectedIds(preSelected);
    } catch (err) {
      console.error("Failed to load immich assets:", err);
      setError("Failed to load photos for this album.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAsset = useCallback((asset: ImmichAsset) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(asset.id)) {
        next.delete(asset.id);
      } else {
        next.add(asset.id);
      }
      return next;
    });
  }, []);

  const handleSaveAppend = () => {
    const urls = assets
      .filter((a) => selectedIds.has(a.id))
      .map((a) => immich.assets.previewUrl(a.id));
    onSelectMultiple(urls, "append");
    onClose();
  };

  const handleSaveReplace = () => {
    const urls = assets
      .filter((a) => selectedIds.has(a.id))
      .map((a) => immich.assets.previewUrl(a.id));
    onSelectMultiple(urls, "replace");
    onClose();
  };

  const resetView = () => {
    setSelectedAlbum(null);
    setAssets([]);
    setSelectedIds(new Set());
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop bg="rgba(0,0,0,0.5)" backdropFilter="blur(6px)" />
        <Dialog.Positioner p={4}>
          <Dialog.Content
            maxW="860px"
            w="100%"
            bg="white"
            borderRadius="2xl"
            boxShadow="0 24px 64px rgba(0,0,0,0.18)"
            overflow="hidden"
            maxH="88vh"
            display="flex"
            flexDirection="column"
          >
            {/* Header */}
            <Flex
              p={{ base: 4, md: 5 }}
              borderBottom="1px solid"
              borderColor="border.subtle"
              justify="space-between"
              align="center"
              bg="white"
              flexShrink={0}
            >
              <HStack gap={3}>
                {selectedAlbum && (
                  <IconButton
                    aria-label="Back to albums"
                    variant="ghost"
                    size="sm"
                    borderRadius="full"
                    onClick={resetView}
                  >
                    <FiChevronLeft size={20} />
                  </IconButton>
                )}
                <Box>
                  <Heading size="md" fontWeight="700" color="brand.900">
                    {selectedAlbum ? selectedAlbum.albumName : "Select Immich Album"}
                  </Heading>
                  <Text fontSize="xs" color="fg.muted">
                    {selectedAlbum
                      ? `${assets.length} photos available — pick images to feature`
                      : "Choose an album to browse and select featured photos"}
                  </Text>
                </Box>
              </HStack>

              <HStack gap={2}>
                {selectedIds.size > 0 && (
                  <Badge colorPalette="teal" variant="subtle" px={2.5} py={1} borderRadius="full">
                    {selectedIds.size} Selected
                  </Badge>
                )}
                <IconButton
                  aria-label="Close modal"
                  variant="ghost"
                  size="sm"
                  borderRadius="full"
                  onClick={onClose}
                >
                  <FiX size={18} />
                </IconButton>
              </HStack>
            </Flex>

            {/* Body */}
            <Dialog.Body p={{ base: 4, md: 6 }} overflowY="auto" flex={1}>
              {loading ? (
                <Flex justify="center" align="center" py={16}>
                  <Spinner size="xl" color="brand.900" />
                </Flex>
              ) : error ? (
                <Flex justify="center" align="center" py={12} direction="column" gap={3}>
                  <Text color="red.500" fontSize="sm">
                    {error}
                  </Text>
                  <Button size="sm" variant="outline" onClick={selectedAlbum ? () => loadAssets(selectedAlbum) : loadAlbums}>
                    Retry
                  </Button>
                </Flex>
              ) : !selectedAlbum ? (
                /* Album Grid */
                albums.length === 0 ? (
                  <Text color="fg.muted" textAlign="center" py={12}>
                    No albums found on Immich server.
                  </Text>
                ) : (
                  <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap={4}>
                    {albums.map((album) => (
                      <Box
                        key={album.id}
                        p={4}
                        borderRadius="xl"
                        border="1px solid"
                        borderColor="border.subtle"
                        bg="bg.surface"
                        cursor="pointer"
                        transition="all 0.2s"
                        _hover={{
                          transform: "translateY(-2px)",
                          boxShadow: "0 8px 24px rgba(73,98,104,0.12)",
                          borderColor: "brand.solid",
                        }}
                        onClick={() => loadAssets(album)}
                      >
                        <Heading size="sm" color="brand.900" mb={1} truncate>
                          {album.albumName}
                        </Heading>
                        <Text fontSize="xs" color="fg.muted">
                          {album.assetCount} photos
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                )
              ) : (
                /* Asset Grid */
                assets.length === 0 ? (
                  <Text color="fg.muted" textAlign="center" py={12}>
                    No photos found in this album.
                  </Text>
                ) : (
                  <Box
                    display="grid"
                    gridTemplateColumns={{
                      base: "repeat(2, 1fr)",
                      sm: "repeat(3, 1fr)",
                      md: "repeat(4, 1fr)",
                    }}
                    gap={2}
                  >
                    {assets.map((asset) => (
                      <AssetItemCard
                        key={asset.id}
                        asset={asset}
                        isSelected={selectedIds.has(asset.id)}
                        isSaved={savedAssetIdSet.has(asset.id)}
                        onToggle={toggleAsset}
                      />
                    ))}
                  </Box>
                )
              )}
            </Dialog.Body>

            {/* Footer — only shown in asset view */}
            {selectedAlbum && (
              <Box
                p={{ base: 3, md: 4 }}
                borderTop="1px solid"
                borderColor="border.subtle"
                bg="white"
                flexShrink={0}
              >
                <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
                  <Text fontSize="sm" color="fg.muted">
                    {selectedIds.size === 0
                      ? "Select photos to feature on the homepage"
                      : `${selectedIds.size} photo${selectedIds.size !== 1 ? "s" : ""} selected`}
                  </Text>
                  <HStack gap={2} flexWrap="wrap">
                    <Button
                      variant="outline"
                      borderRadius="xl"
                      size="sm"
                      onClick={resetView}
                      color="brand.900"
                      borderColor="border.muted"
                    >
                      Back
                    </Button>
                    <Button
                      variant="outline"
                      borderRadius="xl"
                      size="sm"
                      px={4}
                      disabled={selectedIds.size === 0}
                      onClick={handleSaveAppend}
                      color="brand.900"
                      borderColor="brand.solid"
                      _hover={{ bg: "bg.subtle" }}
                    >
                      + Add to Existing Selection ({selectedIds.size})
                    </Button>
                    <Button
                      bg="brand.solid"
                      color="white"
                      borderRadius="xl"
                      size="sm"
                      px={4}
                      disabled={selectedIds.size === 0}
                      onClick={handleSaveReplace}
                      _hover={{ bg: "brand.600" }}
                    >
                      Replace Entire List ({selectedIds.size})
                    </Button>
                  </HStack>
                </Flex>
              </Box>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
