import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  Spinner,
  SimpleGrid,
  Image,
  Dialog,
  HStack,
  IconButton,
  Portal,
} from "@chakra-ui/react";
import { immich } from "../../lib/immich";
import { FiX, FiChevronLeft } from "react-icons/fi";
import type { ImmichAlbum, ImmichAsset } from "../../lib/immich";

interface ImmichPhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export const ImmichPhotoPickerModal = ({ isOpen, onClose, onSelect }: ImmichPhotoPickerModalProps) => {
  const [albums, setAlbums] = useState<ImmichAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<ImmichAlbum | null>(null);
  const [assets, setAssets] = useState<ImmichAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSelectAsset = (asset: ImmichAsset) => {
    // Generate the preview URL which is suitable for the featured photos carousel
    const url = immich.assets.previewUrl(asset.id);
    onSelect(url);
    onClose();
  };

  const resetView = () => {
    setSelectedAlbum(null);
    setAssets([]);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop bg="rgba(0,0,0,0.4)" backdropFilter="blur(4px)" />
        <Dialog.Positioner p={4}>
          <Dialog.Content
            maxW="800px"
            w="100%"
            bg="white"
            borderRadius="xl"
            boxShadow="xl"
            overflow="hidden"
            maxH="85vh"
            display="flex"
            flexDirection="column"
          >
            <Dialog.Header p={4} borderBottom="1px solid" borderColor="border.subtle" flexShrink={0}>
              <Flex justify="space-between" align="center">
                <HStack gap={3}>
                  {selectedAlbum && (
                    <IconButton
                      aria-label="Back to albums"
                      variant="ghost"
                      size="sm"
                      onClick={resetView}
                    >
                      <FiChevronLeft />
                    </IconButton>
                  )}
                  <Dialog.Title fontFamily="heading" fontSize="lg">
                    {selectedAlbum ? selectedAlbum.albumName : "Select from Immich Gallery"}
                  </Dialog.Title>
                </HStack>
                <Dialog.CloseTrigger asChild>
                  <IconButton aria-label="Close" variant="ghost" size="sm">
                    <FiX />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Flex>
            </Dialog.Header>

            <Dialog.Body p={4} overflowY="auto" flex={1} bg="bg.canvas">
              {error && (
                <Box p={4} bg="red.50" color="red.700" borderRadius="md" mb={4}>
                  {error}
                </Box>
              )}

              {loading ? (
                <Flex align="center" justify="center" p={10}>
                  <Spinner size="lg" color="brand.solid" />
                </Flex>
              ) : !selectedAlbum ? (
                // Album Selection View
                albums.length === 0 ? (
                  <Flex align="center" justify="center" p={10}>
                    <Text color="fg.muted">No albums found in Immich.</Text>
                  </Flex>
                ) : (
                  <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap={4}>
                    {albums.map((album) => (
                      <Box
                        key={album.id}
                        p={4}
                        bg="white"
                        borderRadius="lg"
                        border="1px solid"
                        borderColor="border.subtle"
                        cursor="pointer"
                        _hover={{ borderColor: "brand.solid", boxShadow: "sm", transform: "translateY(-2px)" }}
                        transition="all 0.2s"
                        onClick={() => loadAssets(album)}
                      >
                        <Heading size="sm" mb={1} truncate>
                          {album.albumName}
                        </Heading>
                        <Text fontSize="xs" color="fg.muted">
                          {album.assetCount} items
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                )
              ) : (
                // Asset Selection View
                assets.length === 0 ? (
                  <Flex align="center" justify="center" p={10}>
                    <Text color="fg.muted">No photos found in this album.</Text>
                  </Flex>
                ) : (
                  <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={3}>
                    {assets.map((asset) => (
                      <Box
                        key={asset.id}
                        position="relative"
                        borderRadius="md"
                        overflow="hidden"
                        aspectRatio={1}
                        cursor="pointer"
                        className="immich-photo-thumbnail"
                        border="2px solid transparent"
                        _hover={{ borderColor: "brand.solid", opacity: 0.9 }}
                        transition="all 0.2s"
                        onClick={() => handleSelectAsset(asset)}
                      >
                        <Image
                          src={immich.assets.thumbnailUrl(asset.id, "thumbnail")}
                          alt="Immich photo"
                          objectFit="cover"
                          w="100%"
                          h="100%"
                          loading="lazy"
                        />
                      </Box>
                    ))}
                  </SimpleGrid>
                )
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
