import { useState, useEffect, useCallback } from "react";
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
} from "@chakra-ui/react";
import { immich } from "../../lib/immich";
import { FiX, FiChevronLeft, FiCheck } from "react-icons/fi";
import type { ImmichAlbum, ImmichAsset } from "../../lib/immich";

interface ImmichPhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMultiple: (urls: string[]) => void;
  currentUrls?: string[];
}

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
    } catch (err) {
      console.error("Failed to load immich assets:", err);
      setError("Failed to load photos for this album.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAsset = (asset: ImmichAsset) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(asset.id)) {
        next.delete(asset.id);
      } else {
        next.add(asset.id);
      }
      return next;
    });
  };

  const handleSave = () => {
    const urls = assets
      .filter((a) => selectedIds.has(a.id))
      .map((a) => immich.assets.previewUrl(a.id));
    onSelectMultiple(urls);
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
            <Dialog.Header
              p={{ base: 4, md: 5 }}
              borderBottom="1px solid"
              borderColor="border.subtle"
              flexShrink={0}
              bg="bg.canvas"
            >
              <Flex justify="space-between" align="center">
                <HStack gap={3}>
                  {selectedAlbum && (
                    <IconButton
                      aria-label="Back to albums"
                      variant="ghost"
                      size="sm"
                      borderRadius="full"
                      onClick={resetView}
                    >
                      <FiChevronLeft />
                    </IconButton>
                  )}
                  <Box>
                    <Dialog.Title fontFamily="heading" fontSize="lg" color="brand.900" lineHeight={1.2}>
                      {selectedAlbum ? selectedAlbum.albumName : "Select from Immich Gallery"}
                    </Dialog.Title>
                    {selectedAlbum && (
                      <Text fontSize="xs" color="fg.muted" mt={0.5}>
                        Click photos to select. Save all at once.
                      </Text>
                    )}
                  </Box>
                </HStack>
                <HStack gap={2}>
                  {selectedIds.size > 0 && (
                    <Badge
                      bg="brand.solid"
                      color="white"
                      borderRadius="full"
                      px={3}
                      py={1}
                      fontSize="sm"
                      fontWeight="700"
                    >
                      {selectedIds.size} selected
                    </Badge>
                  )}
                  <Dialog.CloseTrigger asChild>
                    <IconButton aria-label="Close" variant="ghost" size="sm" borderRadius="full">
                      <FiX />
                    </IconButton>
                  </Dialog.CloseTrigger>
                </HStack>
              </Flex>
            </Dialog.Header>

            {/* Body */}
            <Dialog.Body p={4} overflowY="auto" flex={1} bg="bg.canvas">
              {error && (
                <Box p={4} bg="red.50" color="red.700" borderRadius="xl" mb={4} fontSize="sm">
                  {error}
                </Box>
              )}

              {loading ? (
                <Flex align="center" justify="center" p={16}>
                  <Spinner size="lg" color="brand.solid" />
                </Flex>
              ) : !selectedAlbum ? (
                // Album Selection View
                albums.length === 0 ? (
                  <Flex align="center" justify="center" p={10}>
                    <Text color="fg.muted">No albums found in Immich.</Text>
                  </Flex>
                ) : (
                  <Box
                    display="grid"
                    gridTemplateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }}
                    gap={3}
                  >
                    {albums.map((album) => (
                      <Box
                        key={album.id}
                        p={4}
                        bg="white"
                        borderRadius="xl"
                        border="1.5px solid"
                        borderColor="border.subtle"
                        cursor="pointer"
                        _hover={{ borderColor: "brand.solid", transform: "translateY(-2px)", boxShadow: "0 8px 24px rgba(73,98,104,0.12)" }}
                        transition="all 0.2s var(--ease-out-quart)"
                        onClick={() => loadAssets(album)}
                      >
                        <Heading size="sm" mb={1} truncate color="brand.900">
                          {album.albumName}
                        </Heading>
                        <Text fontSize="xs" color="fg.muted">
                          {album.assetCount} items
                        </Text>
                      </Box>
                    ))}
                  </Box>
                )
              ) : (
                // Multi-select Asset View
                assets.length === 0 ? (
                  <Flex align="center" justify="center" p={10}>
                    <Text color="fg.muted">No photos found in this album.</Text>
                  </Flex>
                ) : (
                  <Box
                    display="grid"
                    gridTemplateColumns={{ base: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }}
                    gap={2}
                  >
                    {assets.map((asset) => {
                      const isSelected = selectedIds.has(asset.id);
                      return (
                        <Box
                          key={asset.id}
                          position="relative"
                          borderRadius="lg"
                          overflow="hidden"
                          aspectRatio={1}
                          cursor="pointer"
                          border="3px solid"
                          borderColor={isSelected ? "brand.solid" : "transparent"}
                          onClick={() => toggleAsset(asset)}
                          transition="all 0.18s var(--ease-out-quart)"
                          _hover={{ transform: "scale(0.97)", borderColor: isSelected ? "brand.solid" : "border.muted" }}
                        >
                          <img
                            src={immich.assets.thumbnailUrl(asset.id, "thumbnail")}
                            alt="Immich photo"
                            style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }}
                            loading="lazy"
                          />
                          {/* Overlay on hover and when selected */}
                          <Flex
                            position="absolute"
                            inset={0}
                            bg={isSelected ? "rgba(73,98,104,0.45)" : "rgba(0,0,0,0)"}
                            transition="all 0.18s"
                            align="center"
                            justify="center"
                            _groupHover={{ bg: "rgba(0,0,0,0.2)" }}
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
                          {currentUrls.some((u) => u.includes(asset.id)) && !isSelected && (
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
                    })}
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
                <Flex justify="space-between" align="center" gap={3}>
                  <Text fontSize="sm" color="fg.muted">
                    {selectedIds.size === 0
                      ? "Select photos to feature on the homepage"
                      : `${selectedIds.size} photo${selectedIds.size !== 1 ? "s" : ""} selected — replaces current set`}
                  </Text>
                  <HStack gap={2}>
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
                      bg="brand.solid"
                      color="white"
                      borderRadius="xl"
                      size="sm"
                      px={6}
                      disabled={selectedIds.size === 0}
                      onClick={handleSave}
                      _hover={{ bg: "brand.600" }}
                    >
                      Save {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}Photos
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
