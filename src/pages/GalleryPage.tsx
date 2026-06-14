import {
  Box,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Text,
  VStack,
  Image,
  Button,
  Input,
  Spinner,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabase";
import { toaster } from "../components/ui/toaster";

interface DBPhoto {
  id: number;
  src: string;
  caption: string;
  likes: number;
  student_id: string | null;
  author_name: string | null;
  created_at: string;
}

export function GalleryPage() {
  const { user } = useUser();
  const [photos, setPhotos] = useState<DBPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Upload Form State
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  // Preset testing images to help developers upload quickly
  const samplePresets = [
    "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=400&fit=crop",
  ];

  const fetchPhotos = async (active = true) => {
    try {
      const { data, error } = await supabase
        .from("gallery_photos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (active && data) {
        setPhotos(data as DBPhoto[]);
      }
    } catch (err) {
      console.error("Error fetching gallery photos:", err);
      if (active) {
        toaster.create({
          title: "Error loading gallery",
          description: "Failed to fetch photos from Supabase.",
          type: "error",
        });
      }
    } finally {
      if (active) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      await fetchPhotos(active);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  // Handle image submission upload
  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toaster.create({
        title: "Sign In Required",
        description: "Please sign in to upload photos.",
        type: "warning",
      });
      return;
    }

    const trimmedUrl = imageUrl.trim();
    const trimmedCaption = caption.trim();

    if (!trimmedUrl || !trimmedCaption) {
      toaster.create({
        title: "All fields are required",
        type: "error",
      });
      return;
    }

    setUploading(true);
    try {
      const { data, error } = await supabase
        .from("gallery_photos")
        .insert({
          src: trimmedUrl,
          caption: trimmedCaption,
          student_id: user.student_id,
          author_name: user.nickname || "Student",
          likes: 0,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setPhotos((prev) => [data as DBPhoto, ...prev]);
        setImageUrl("");
        setCaption("");
        setShowUploadForm(false);
        toaster.create({
          title: "Photo Uploaded!",
          description: "Your image was saved successfully.",
          type: "success",
        });
      }
    } catch (err) {
      console.error("Photo upload failed:", err);
      toaster.create({
        title: "Upload failed",
        type: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle photo liking
  const handleLikePhoto = async (photoId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const match = photos.find((p) => p.id === photoId);
      if (!match) return;

      const nextLikes = match.likes + 1;
      const { error } = await supabase
        .from("gallery_photos")
        .update({ likes: nextLikes })
        .eq("id", photoId);

      if (error) throw error;

      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, likes: nextLikes } : p)),
      );
    } catch (err) {
      console.error("Liking photo failed:", err);
    }
  };

  return (
    <Box
      position="relative"
      zIndex={10}
      maxW="var(--container-max)"
      mx="auto"
      px={{ base: 4, md: 16 }}
      pt={{ base: 2, md: 28 }}
      pb={{ base: 4, md: 20 }}
      minH="100vh"
    >
      {/* Page Header */}
      <VStack
        gap={2}
        mb={{ base: 6, md: 12 }}
        animation="fade-in-up 0.6s var(--ease-out-expo) both"
      >
        <Heading
          as="h1"
          fontFamily="heading"
          fontSize={{ base: "2rem", md: "3.5rem" }}
          fontWeight={700}
          lineHeight={1.1}
          letterSpacing="-0.02em"
          color="accent.solid"
          textAlign="center"
        >
          Baan 7 Gallery
        </Heading>
        <Text
          color="fg.muted"
          fontSize={{ base: "sm", md: "lg" }}
          textAlign="center"
          maxW="lg"
        >
          Relive the moments. View and upload photos from our activities.
        </Text>
        <HStack gap={4} mt={4}>
          <Button
            type="button"
            display="inline-flex"
            alignItems="center"
            gap={2}
            bg="accent.solid"
            color="white"
            px={6}
            py={2.5}
            borderRadius="full"
            fontSize="sm"
            fontWeight="600"
            cursor="pointer"
            transition="all 0.3s var(--ease-out-quart)"
            boxShadow="0 4px 14px rgba(124, 86, 63, 0.2)"
            _hover={{
              transform: "translateY(-1px)",
              boxShadow: "0 6px 20px rgba(124, 86, 63, 0.3)",
            }}
            onClick={() => {
              if (!user) {
                toaster.create({
                  title: "Sign In Required",
                  description:
                    "Please sign in or register to upload photos to the gallery.",
                  type: "warning",
                });
                return;
              }
              setShowUploadForm(!showUploadForm);
            }}
            minH="44px"
          >
            <Box className="material-symbols-outlined" fontSize="lg">
              add_photo_alternate
            </Box>
            {showUploadForm ? "Cancel Upload" : "Upload Photo"}
          </Button>
        </HStack>
      </VStack>

      {/* Upload Form Box */}
      {showUploadForm && user && (
        <Box
          bg="var(--c-white)"
          p={6}
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="2xl"
          boxShadow="var(--shadow-lagoon)"
          maxW="md"
          mx="auto"
          mb={8}
          animation="scale-in 0.3s var(--ease-out-quart)"
        >
          <VStack gap={4} as="form" onSubmit={handleUploadPhoto}>
            <Heading
              size="xs"
              color="var(--c-chocolate)"
              fontFamily="'Playfair Display', serif"
              fontSize="lg"
              fontWeight="700"
            >
              Share a New Memory
            </Heading>
            <VStack align="stretch" gap={1} w="100%">
              <Text
                fontSize="xs"
                fontWeight="700"
                color="var(--c-muted)"
                textTransform="uppercase"
              >
                Image URL
              </Text>
              <Input
                placeholder="Paste an Unsplash or static image URL..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                h="44px"
                borderRadius="xl"
                border="1.5px solid var(--c-outline)"
                bg="var(--c-ivory)"
                required
              />
              <HStack gap={2} mt={1}>
                <Text fontSize="2xs" color="fg.subtle">
                  Presets:
                </Text>
                {samplePresets.map((preset, i) => (
                  <Button
                    key={preset}
                    type="button"
                    size="2xs"
                    variant="outline"
                    borderRadius="full"
                    onClick={() => setImageUrl(preset)}
                    fontSize="3xs"
                    h="20px"
                  >
                    Image {i + 1}
                  </Button>
                ))}
              </HStack>
            </VStack>
            <VStack align="stretch" gap={1} w="100%">
              <Text
                fontSize="xs"
                fontWeight="700"
                color="var(--c-muted)"
                textTransform="uppercase"
              >
                Caption
              </Text>
              <Input
                placeholder="e.g. Baan 7 Orientation squad! 📸"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                h="44px"
                borderRadius="xl"
                border="1.5px solid var(--c-outline)"
                bg="var(--c-ivory)"
                required
              />
            </VStack>
            <Button
              type="submit"
              bg="var(--c-lagoon)"
              color="white"
              h="44px"
              w="100%"
              borderRadius="xl"
              cursor="pointer"
              _hover={{ bg: "#3c5156" }}
              loading={uploading}
            >
              Post Image
            </Button>
          </VStack>
        </Box>
      )}

      {/* Grid Display */}
      {loading ? (
        <Flex justify="center" py={12}>
          <Spinner size="lg" color="var(--c-lagoon)" />
        </Flex>
      ) : photos.length === 0 ? (
        <Flex
          justify="center"
          py={12}
          bg="bg.surface"
          border="1px dashed"
          borderColor="border.subtle"
          borderRadius="2xl"
        >
          <Text color="fg.subtle">
            No photos uploaded yet. Be the first to share a memory!
          </Text>
        </Flex>
      ) : (
        <SimpleGrid
          columns={{ base: 1, sm: 2, md: 3, lg: 4 }}
          gap={{ base: 3, md: 4 }}
        >
          {photos.map((img, i) => (
            <GalleryCard
              key={img.id}
              img={img}
              index={i}
              isHovered={hoveredId === img.id}
              onHoverStart={() => setHoveredId(img.id)}
              onHoverEnd={() => setHoveredId(null)}
              onLike={handleLikePhoto}
            />
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}

interface GalleryCardProps {
  img: DBPhoto;
  index: number;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onLike: (id: number, e: React.MouseEvent) => void;
}

function GalleryCard({
  img,
  index,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onLike,
}: GalleryCardProps) {
  return (
    <Box
      className="gallery-card"
      position="relative"
      borderRadius="xl"
      overflow="hidden"
      cursor="pointer"
      role="group"
      tabIndex={0}
      aria-label={`${img.caption} by ${img.author_name || "Student"}`}
      animation={`scale-in 0.5s var(--ease-out-expo) ${Math.min(0.05 + index * 0.04, 0.35)}s both`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
    >
      {/* Image container */}
      <Box
        h={{
          base: "220px",
          sm: "240px",
          md: index % 3 === 0 ? "320px" : "260px",
        }}
      >
        <Image
          src={img.src}
          alt={img.caption}
          className="gallery-img"
          w="100%"
          h="100%"
          objectFit="cover"
          loading="lazy"
          decoding="async"
          transition="transform 0.5s var(--ease-out-quart)"
        />
      </Box>

      {/* Desktop overlay — appears on hover/focus */}
      <Box
        className="gallery-card-overlay"
        display={{ base: "none", sm: "flex" }}
        position="absolute"
        inset={0}
        bg="linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)"
        opacity={isHovered ? 1 : 0}
        transition="opacity 0.3s"
        flexDirection="column"
        justifyContent="flex-end"
        p={4}
      >
        <Text color="white" fontSize="sm" fontWeight="600" lineHeight={1.3}>
          {img.caption}
        </Text>
        <Flex justify="space-between" align="center" mt={1}>
          <Text color="rgba(255,255,255,0.7)" fontSize="xs">
            {img.author_name || "Student"}
          </Text>
          <Button
            type="button"
            aria-label="Like photo"
            onClick={(e) => onLike(img.id, e)}
            variant="ghost"
            p={0}
            minH="32px"
            h="32px"
            minW="40px"
            w="40px"
            display="flex"
            alignItems="center"
            gap={1}
            color="white"
            _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
            cursor="pointer"
          >
            <Box
              className="material-symbols-outlined"
              fontSize="sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              favorite
            </Box>
            <Text fontSize="xs" fontWeight="600">
              {img.likes}
            </Text>
          </Button>
        </Flex>
      </Box>

      {/* Mobile caption — always visible below image */}
      <Box display={{ base: "block", sm: "none" }} p={3} bg="bg.surface">
        <Flex justify="space-between" align="center">
          <Box>
            <Text
              fontSize="sm"
              fontWeight="600"
              color="fg.default"
              lineHeight={1.3}
            >
              {img.caption}
            </Text>
            <Text fontSize="xs" color="fg.subtle" mt={0.5}>
              {img.author_name || "Student"}
            </Text>
          </Box>
          <Button
            type="button"
            aria-label="Like photo"
            onClick={(e) => onLike(img.id, e)}
            variant="ghost"
            p={0}
            minH="32px"
            h="32px"
            minW="40px"
            w="40px"
            display="flex"
            alignItems="center"
            gap={1}
            color="fg.subtle"
            _hover={{ bg: "rgba(0,0,0,0.05)" }}
            cursor="pointer"
          >
            <Box
              className="material-symbols-outlined"
              fontSize="sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              favorite
            </Box>
            <Text fontSize="xs" fontWeight="600">
              {img.likes}
            </Text>
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}
