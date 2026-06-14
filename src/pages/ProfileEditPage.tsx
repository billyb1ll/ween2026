import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Text,
  VStack,
  HStack,
  Flex,
  Image,
  NativeSelect,
  Textarea,
} from "@chakra-ui/react";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabase";
import { toaster } from "../components/ui/toaster";

const PRESET_COLORS = [
  "#496268", // Lagoon
  "#7c563f", // Chocolate
  "#8c7b74", // Warm Muted Brown
  "#9d806c", // Light Cocoa
  "#5b6c6b", // Sage Slate
  "#a38c75", // Warm Ochre
];

const THAI_FACULTIES = [
  "แพทยศาสตร์ศิริราชพยาบาล (SI)",
  "วิทยาศาสตร์ (SC)",
  "แพทยศาสตร์โรงพยาบาลรามาฯ (RA)",
  "ทันตแพทยศาสตร์ (DT)",
  "เทคนิคการแพทย์ (MT)",
  "สาธารณสุขศาสตร์ (PH)",
  "พยาบาลศาสตร์ (NS)",
  "กายภาพบำบัด (PT)",
  "โรงเรียนพยาบาลรามาธิบดี (NR)",
  "วิศวกรรมศาสตร์ (EG)",
  "สิ่งแวดล้อมและทรัพยากรศาสตร์ (EN)",
  "วิทยาเขตกาญจนบุรี (KA)",
  "สัตวแพทยศาสตร์ (VS)",
  "หลักสูตรแพทยศาสตร์บัณฑิต โครงการผลิตแพทย์เพื่อชาวชนบท (PI)",
  "สาขาวิชากิจกรรมบำบัด คณะกายภาพบำบัด (OT)",
  "โครงการจัดตั้งวิทยาเขตนครสวรรค์ (NA)",
  "โครงการจัดตั้งวิทยาเขตอำนาจเจริญ (AM)",
  "ศิลปศาสตร์ (LA)",
  "วิทยาลัยศาสนศึกษา (CRS)",
  "วิทยาลัยนานาชาติ (IC)",
  "เทคโนโลยีสารสนเทศและการสื่อสาร (ICT)",
  "โรงเรียนกายอุปกรณ์สิรินธร (PO)",
  "วิทยาลัยวิทยาศาสตร์และเทคโนโลยี (SS)",
  "คณะสังคมศาสตร์และมนุษย์ศาสตร์ (SH)",
  "วิทยาลับดุริยางคศิลป์ (MS)",
  "วิทยาลัยราชสุดา (RS)",
  "เภสัชศาสตร์ (PY)",
  "เวชศาสตร์เขตร้อน (TM)",
];

const STAFF_ROLES = [
  "ประธาน",
  "เลขา",
  "เหรัญญิก",
  "ประสานงาน",
  "Timer",
  "Creative & Art",
  "โสต",
  "สวัสดิการและพัสดุ",
  "พยาบาล",
  "สถานที่",
  "สันทนาการ",
  "พี่กลุ่ม",
  "ทะเบียน",
];

export function ProfileEditPage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useUser();

  const [nickname, setNickname] = useState(user?.nickname || "");
  const [faculty, setFaculty] = useState(user?.faculty || "");
  const [major, setMajor] = useState(user?.major || "");
  const [ig, setIg] = useState(user?.ig || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarColor, setAvatarColor] = useState(
    user?.avatar_color || PRESET_COLORS[0],
  );
  const [profilePicUrl, setProfilePicUrl] = useState(
    user?.profile_pic_url || "",
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // House Position States (Option A predefined roles + custom fallback)
  const isCustomPosition =
    user?.house_position && !STAFF_ROLES.includes(user.house_position);
  const [housePosition, setHousePosition] = useState(
    user?.house_position || "",
  );
  const [selectedSelectRole, setSelectedSelectRole] = useState(
    isCustomPosition ? "Other" : user?.house_position || "",
  );
  const [customPositionText, setCustomPositionText] = useState(
    isCustomPosition ? user?.house_position || "" : "",
  );

  // Crop States
  const [isOpenCrop, setIsOpenCrop] = useState(false);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        setImageObj(img);
        setIsOpenCrop(true);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCropCancel = () => {
    setIsOpenCrop(false);
    setImageObj(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCropSave = async (blob: Blob) => {
    if (!user) return;

    setUploading(true);
    setIsOpenCrop(false);

    try {
      const fileExt = "jpg";
      const fileName = `${user.student_id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("profiles")
        .upload(filePath, blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("profiles").getPublicUrl(filePath);

      setProfilePicUrl(publicUrl);
      toaster.create({
        title: "Avatar updated!",
        description: "Successfully cropped and uploaded profile picture.",
        type: "success",
      });
    } catch (err) {
      console.error("File upload failed:", err);
      toaster.create({
        title: "Upload failed",
        description: "Please try again.",
        type: "error",
      });
    } finally {
      setUploading(false);
      setImageObj(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname.trim() || !faculty.trim()) {
      toaster.create({
        title: "Nickname and Faculty are required",
        type: "error",
      });
      return;
    }

    // Enforce house_position for staff/moderators
    const needsHousePosition =
      user?.role === "staff" || user?.role === "moderator";
    if (needsHousePosition && !housePosition.trim()) {
      toaster.create({
        title: "House Position is required",
        description: "Please select or enter your staff position in the house.",
        type: "error",
      });
      return;
    }

    setSubmitting(true);
    const success = await updateProfile({
      nickname: nickname.trim(),
      faculty: faculty.trim(),
      major: major.trim(),
      ig: ig.trim(),
      avatarColor,
      bio: bio.trim(),
      profilePicUrl: profilePicUrl.trim(),
      photoPool: user?.photo_pool || [], // keep photo pool intact
      housePosition: housePosition.trim(),
    });
    setSubmitting(false);

    if (success) {
      toaster.create({
        title: "Profile Saved!",
        type: "success",
      });
      navigate("/");
    } else {
      toaster.create({
        title: "Save failed",
        type: "error",
      });
    }
  };

  return (
    <Box
      minH="90vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      py={{ base: 6, md: 12 }}
      px={4}
    >
      <Container maxW="md">
        <Box
          bg="bg.surface"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="2xl"
          p={{ base: 5, md: 8 }}
          boxShadow="var(--shadow-card)"
          animation="scale-in 0.4s var(--ease-out-quart)"
        >
          <VStack align="stretch" gap={6} as="form" onSubmit={handleSubmit}>
            <VStack align="center" textAlign="center" gap={1}>
              <Heading
                as="h1"
                fontSize="2xl"
                color="accent.solid"
                fontWeight="700"
              >
                Manage Profile
              </Heading>
              <Text color="fg.muted" fontSize="sm">
                Set up your orientation identity. Let's make connections!
              </Text>
            </VStack>

            {/* Required setup warning for staff/moderator */}
            {(user?.role === "staff" || user?.role === "moderator") &&
              !user.house_position && (
                <Box
                  bg="rgba(197, 48, 48, 0.08)"
                  border="1.5px solid"
                  borderColor="red.500"
                  borderRadius="xl"
                  p={3.5}
                  w="100%"
                  role="alert"
                  aria-live="assertive"
                >
                  <Text
                    fontSize="xs"
                    color="red.600"
                    fontWeight="700"
                    display="flex"
                    alignItems="center"
                    gap={1.5}
                  >
                    <Box
                      as="span"
                      className="material-symbols-outlined"
                      fontSize="16px"
                    >
                      campaign
                    </Box>
                    House Position Required: Please select your official role
                    below to activate your orientation staff profile.
                  </Text>
                </Box>
              )}

            <VStack align="stretch" gap={4}>
              {/* Nickname */}
              <VStack align="stretch" gap={1.5}>
                <Box
                  fontSize="xs"
                  fontWeight="700"
                  color="accent.solid"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  <label htmlFor="edit-nickname">
                    Nickname (ชื่อเล่น){" "}
                    <Box as="span" color="var(--c-error)">
                      *
                    </Box>
                  </label>
                </Box>
                <Input
                  id="edit-nickname"
                  placeholder="e.g. บิล"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="bg.hero"
                  _focus={{ borderColor: "accent.solid" }}
                  h="48px"
                  fontSize="sm"
                  required
                />
              </VStack>

              {/* Faculty Dropdown */}
              <VStack align="stretch" gap={1.5}>
                <Box
                  fontSize="xs"
                  fontWeight="700"
                  color="accent.solid"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  <label htmlFor="edit-faculty">
                    Faculty (คณะ){" "}
                    <Box as="span" color="var(--c-error)">
                      *
                    </Box>
                  </label>
                </Box>
                <NativeSelect.Root width="100%">
                  <NativeSelect.Field
                    id="edit-faculty"
                    aria-label="Faculty (คณะ)"
                    title="Faculty (คณะ)"
                    value={faculty}
                    onChange={(e) => setFaculty(e.currentTarget.value)}
                    borderRadius="xl"
                    border="1.5px solid var(--c-outline)"
                    bg="bg.hero"
                    px={4}
                    _focus={{
                      borderColor: "accent.solid",
                    }}
                  >
                    <option value="">Select Faculty...</option>
                    {THAI_FACULTIES.map((fac) => {
                      const cleanVal = fac.split(" (")[0];
                      return (
                        <option key={fac} value={cleanVal}>
                          {fac}
                        </option>
                      );
                    })}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </VStack>

              {/* Major (Academic Major) */}
              <VStack align="stretch" gap={1.5}>
                <Box
                  fontSize="xs"
                  fontWeight="700"
                  color="accent.solid"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  <label htmlFor="edit-major">
                    Major (สาขา){" "}
                    <Text
                      as="span"
                      color="fg.subtle"
                      fontSize="2xs"
                      fontWeight="normal"
                    >
                      (Optional)
                    </Text>
                  </label>
                </Box>
                <Input
                  id="edit-major"
                  placeholder="e.g. วิทยาการคอมพิวเตอร์"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="bg.hero"
                  _focus={{ borderColor: "accent.solid" }}
                  h="48px"
                  fontSize="sm"
                />
                <Text fontSize="2xs" color="fg.subtle" mt={1}>
                  Only visible to verified Baan 7 freshmen
                </Text>
              </VStack>

              {/* House Position (Staff/Moderator Only - Required) */}
              {(user?.role === "staff" || user?.role === "moderator") && (
                <VStack align="stretch" gap={1.5}>
                  <Box
                    fontSize="xs"
                    fontWeight="700"
                    color="accent.solid"
                    textTransform="uppercase"
                    letterSpacing="0.05em"
                  >
                    <label htmlFor="edit-house-position">
                      House Position (ตำแหน่ง staff){" "}
                      <Text as="span" color="red.500" fontSize="xs">
                        * Required
                      </Text>
                    </label>
                  </Box>
                  <NativeSelect.Root width="100%">
                    <NativeSelect.Field
                      id="edit-house-position"
                      aria-label="House Position (ตำแหน่ง staff)"
                      title="House Position (ตำแหน่ง staff)"
                      value={selectedSelectRole}
                      onChange={(e) => {
                        const val = e.currentTarget.value;
                        setSelectedSelectRole(val);
                        if (val === "Other") {
                          setHousePosition(customPositionText);
                        } else {
                          setHousePosition(val);
                        }
                      }}
                      borderRadius="xl"
                      border="1.5px solid var(--c-outline)"
                      bg="bg.hero"
                      _focus={{ borderColor: "accent.solid" }}
                      h="48px"
                      fontSize="sm"
                      px={4}
                    >
                      <option value="">Select Position...</option>
                      {STAFF_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                      <option value="Other">Other / อื่นๆ...</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>

                  {selectedSelectRole === "Other" && (
                    <Input
                      id="custom-house-position"
                      aria-label="Custom house position"
                      placeholder="Enter custom position (e.g. ตากล้องพิเศษ)"
                      value={customPositionText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomPositionText(val);
                        setHousePosition(val);
                      }}
                      borderRadius="xl"
                      border="1.5px solid var(--c-outline)"
                      bg="bg.hero"
                      _focus={{ borderColor: "accent.solid" }}
                      h="48px"
                      fontSize="sm"
                      mt={1.5}
                      required
                    />
                  )}
                  <Text fontSize="2xs" color="fg.subtle" mt={1}>
                    This position is displayed on your sticker card album
                  </Text>
                </VStack>
              )}

              {/* Instagram */}
              <VStack align="stretch" gap={1.5}>
                <Box
                  fontSize="xs"
                  fontWeight="700"
                  color="accent.solid"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  <label htmlFor="edit-ig">
                    Instagram Account (IG){" "}
                    <Text
                      as="span"
                      color="fg.subtle"
                      fontSize="2xs"
                      fontWeight="normal"
                    >
                      (Optional)
                    </Text>
                  </label>
                </Box>
                <Input
                  id="edit-ig"
                  placeholder="e.g. chula.freshman"
                  value={ig}
                  onChange={(e) => setIg(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="bg.hero"
                  _focus={{ borderColor: "accent.solid" }}
                  h="48px"
                  fontSize="sm"
                />
                <Text fontSize="2xs" color="fg.subtle" mt={1}>
                  Only visible to verified Baan 7 freshmen
                </Text>
              </VStack>

              {/* Bio */}
              <VStack align="stretch" gap={1.5}>
                <Box
                  fontSize="xs"
                  fontWeight="700"
                  color="accent.solid"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  <label htmlFor="edit-bio">
                    Bio (คำโปรย){" "}
                    <Text
                      as="span"
                      color="fg.subtle"
                      fontSize="2xs"
                      fontWeight="normal"
                    >
                      (Optional)
                    </Text>
                  </label>
                </Box>
                <Textarea
                  id="edit-bio"
                  placeholder="e.g. สนใจเรื่องสิ่งแวดล้อม ชอบฟังเพลงอินดี้"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="bg.hero"
                  _focus={{ borderColor: "accent.solid" }}
                  minH="80px"
                  fontSize="sm"
                  py={3}
                />
              </VStack>

              {/* Avatar Color Picker */}
              <VStack align="stretch" gap={2}>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  color="accent.solid"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  Avatar Background Color
                </Text>
                <HStack gap={3}>
                  {PRESET_COLORS.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      aria-label={`Select color ${c}`}
                      w="44px"
                      h="44px"
                      minW="44px"
                      borderRadius="full"
                      bg={c}
                      cursor="pointer"
                      border={
                        avatarColor === c
                          ? "2.5px solid var(--c-chocolate)"
                          : "1px solid rgba(0,0,0,0.1)"
                      }
                      transform={avatarColor === c ? "scale(1.15)" : "none"}
                      transition="all 0.2s ease"
                      _hover={{ transform: "scale(1.15)", bg: c }}
                      onClick={() => setAvatarColor(c)}
                      p={0}
                    />
                  ))}
                </HStack>
              </VStack>

              {/* Profile Image Uploader */}
              <VStack align="stretch" gap={2}>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  color="accent.solid"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  Profile Picture
                </Text>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  display="none"
                />
                <Flex gap={2}>
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                    bg="bg.hero"
                    color="accent.solid"
                    border="1px solid"
                    borderColor="border.subtle"
                    h="44px"
                    borderRadius="xl"
                    cursor="pointer"
                    _hover={{ bg: "bg.surface" }}
                    flex={1}
                  >
                    Upload Photo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const url = prompt("Enter image URL:");
                      if (url) setProfilePicUrl(url);
                    }}
                    h="44px"
                    borderRadius="xl"
                    cursor="pointer"
                    _hover={{ bg: "bg.hero" }}
                  >
                    URL
                  </Button>
                </Flex>
                {profilePicUrl && (
                  <Box
                    mt={2}
                    borderRadius="xl"
                    overflow="hidden"
                    maxH="120px"
                    w="100%"
                    border="1px solid"
                    borderColor="border.subtle"
                  >
                    <Image
                      src={profilePicUrl}
                      alt="Preview"
                      w="100%"
                      h="100%"
                      objectFit="cover"
                    />
                  </Box>
                )}
              </VStack>
            </VStack>

            <HStack w="100%" gap={3}>
              <Button
                type="button"
                variant="outline"
                borderColor="border.subtle"
                color="accent.solid"
                borderRadius="xl"
                h="50px"
                flex={1}
                fontSize="md"
                fontWeight="600"
                cursor="pointer"
                onClick={() => navigate("/")}
                _hover={{ bg: "bg.hero" }}
              >
                Cancel (ยกเลิก)
              </Button>
              <Button
                type="submit"
                bg="accent.solid"
                color="white"
                borderRadius="xl"
                h="50px"
                flex={2}
                fontSize="md"
                fontWeight="700"
                _hover={{ bg: "chocolate.600" }}
                loading={submitting}
              >
                Save Settings
              </Button>
            </HStack>
          </VStack>
        </Box>
      </Container>

      {/* Crop Overlay Modal */}
      <AvatarCropModal
        isOpen={isOpenCrop}
        imageObj={imageObj}
        onCancel={handleCropCancel}
        onSave={handleCropSave}
      />
    </Box>
  );
}

interface AvatarCropModalProps {
  isOpen: boolean;
  imageObj: HTMLImageElement | null;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}

export function AvatarCropModal({
  isOpen,
  imageObj,
  onCancel,
  onSave,
}: AvatarCropModalProps) {
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  const C = 400; // Canvas resolution

  const clampPan = useCallback(
    (px: number, py: number, currentZoom: number) => {
      if (!imageObj) return { x: 0, y: 0 };
      const baseScale = Math.max(C / imageObj.width, C / imageObj.height);
      const scale = baseScale * currentZoom;
      const sw = imageObj.width * scale;
      const sh = imageObj.height * scale;

      const limitX = Math.max(0, (sw - C) / 2);
      const limitY = Math.max(0, (sh - C) / 2);

      return {
        x: Math.max(-limitX, Math.min(limitX, px)),
        y: Math.max(-limitY, Math.min(limitY, py)),
      };
    },
    [imageObj],
  );

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      if (!imageObj || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleFactor = C / rect.width;
      setIsDragging(true);
      dragStart.current = {
        x: clientX * scaleFactor - pan.x,
        y: clientY * scaleFactor - pan.y,
      };
    },
    [imageObj, pan],
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging || !imageObj || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleFactor = C / rect.width;
      const newX = clientX * scaleFactor - dragStart.current.x;
      const newY = clientY * scaleFactor - dragStart.current.y;
      const clamped = clampPan(newX, newY, zoom);
      setPan(clamped);
    },
    [isDragging, imageObj, zoom, clampPan],
  );

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj || !isOpen) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, C, C);

    // Calculate scaling
    const baseScale = Math.max(C / imageObj.width, C / imageObj.height);
    const scale = baseScale * zoom;
    const sw = imageObj.width * scale;
    const sh = imageObj.height * scale;

    // Centered position + pan
    const x = (C - sw) / 2 + pan.x;
    const y = (C - sh) / 2 + pan.y;

    // Draw image
    ctx.drawImage(imageObj, x, y, sw, sh);
  }, [imageObj, zoom, pan, isOpen]);

  const handleCropSaveLocal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onSave(blob);
        } else {
          toaster.create({ title: "Cropping failed", type: "error" });
        }
      },
      "image/jpeg",
      0.9,
    );
  }, [onSave]);

  // Global key event listeners inside the modal lifecycle
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleCropSaveLocal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel, handleCropSaveLocal]);

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      top="0"
      left="0"
      right="0"
      bottom="0"
      bg="color-mix(in srgb, var(--c-ink) 85%, transparent)"
      backdropFilter="blur(8px)"
      zIndex="9999"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        bg="bg.surface"
        border="1px solid"
        borderColor="border.subtle"
        borderRadius="2xl"
        width={{ base: "calc(100% - 32px)", sm: "360px" }}
        maxH={{ base: "90vh", sm: "620px" }}
        boxShadow="var(--shadow-card)"
        animation="scale-in 0.3s var(--ease-out-quart)"
        display="flex"
        flexDirection="column"
        overflow="hidden"
      >
        <VStack gap={5} align="stretch" overflowY="auto" p={6}>
          <VStack align="center" textAlign="center" gap={1}>
            <Heading
              as="h2"
              fontSize="lg"
              color="accent.solid"
              fontWeight="700"
            >
              Adjust Profile Pic
            </Heading>
            <Text color="fg.muted" fontSize="xs">
              Drag to pan, slide to zoom. Ensure your face fits inside the
              circle.
            </Text>
          </VStack>

          {/* Crop Canvas Wrapper */}
          <Box
            position="relative"
            w="100%"
            maxW={{ base: "280px", sm: "320px" }}
            aspectRatio="1/1"
            mx="auto"
            bg="black"
            borderRadius="xl"
            overflow="hidden"
            boxShadow="inner"
          >
            <canvas
              ref={canvasRef}
              width={C}
              height={C}
              aria-label="Profile picture crop editor"
              className="crop-canvas"
              data-dragging={isDragging ? "true" : "false"}
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                handleStart(e.clientX - rect.left, e.clientY - rect.top);
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                handleMove(e.clientX - rect.left, e.clientY - rect.top);
              }}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={(e) => {
                if (e.touches[0]) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  handleStart(
                    e.touches[0].clientX - rect.left,
                    e.touches[0].clientY - rect.top,
                  );
                }
              }}
              onTouchMove={(e) => {
                if (e.touches[0]) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  handleMove(
                    e.touches[0].clientX - rect.left,
                    e.touches[0].clientY - rect.top,
                  );
                }
              }}
              onTouchEnd={handleEnd}
            />

            {/* Circular Mask Overlay */}
            <Box
              position="absolute"
              top="0"
              left="0"
              width="100%"
              height="100%"
              pointerEvents="none"
              background="radial-gradient(circle, transparent 46%, color-mix(in srgb, var(--c-ink) 75%, transparent) 47%)"
            >
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                width="93.75%"
                height="93.75%"
                borderRadius="full"
                border="2.5px dashed rgba(255, 255, 255, 0.8)"
                boxShadow="0 0 0 9999px color-mix(in srgb, var(--c-ink) 10%, transparent)"
              />
            </Box>
          </Box>

          {/* Slider Controls */}
          <VStack gap={2} align="stretch">
            <Text
              fontSize="2xs"
              fontWeight="700"
              color="accent.solid"
              textTransform="uppercase"
              letterSpacing="0.05em"
            >
              Zoom Control
            </Text>
            <HStack gap={3} px={1}>
              <Button
                size="xs"
                h="44px"
                w="44px"
                minW="44px"
                borderRadius="lg"
                variant="outline"
                borderColor="border.subtle"
                color="accent.solid"
                onClick={() => {
                  const newZoom = Math.max(1, zoom - 0.1);
                  setZoom(newZoom);
                  setPan((prev) => clampPan(prev.x, prev.y, newZoom));
                }}
                _hover={{ bg: "bg.hero" }}
                cursor="pointer"
              >
                -
              </Button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                aria-label="Zoom level"
                title="Zoom level"
                className="crop-slider"
                onChange={(e) => {
                  const z = parseFloat(e.target.value);
                  setZoom(z);
                  setPan((prev) => clampPan(prev.x, prev.y, z));
                }}
              />
              <Button
                size="xs"
                h="44px"
                w="44px"
                minW="44px"
                borderRadius="lg"
                variant="outline"
                borderColor="border.subtle"
                color="accent.solid"
                onClick={() => {
                  const newZoom = Math.min(3, zoom + 0.1);
                  setZoom(newZoom);
                  setPan((prev) => clampPan(prev.x, prev.y, newZoom));
                }}
                _hover={{ bg: "bg.hero" }}
                cursor="pointer"
              >
                +
              </Button>
            </HStack>
          </VStack>

          {/* Actions */}
          <HStack gap={3} mt={2}>
            <Button
              variant="outline"
              borderColor="border.subtle"
              color="accent.solid"
              borderRadius="xl"
              h="44px"
              flex={1}
              fontSize="sm"
              fontWeight="600"
              onClick={onCancel}
              _hover={{ bg: "bg.hero" }}
              cursor="pointer"
            >
              Cancel
            </Button>
            <Button
              bg="accent.solid"
              color="white"
              borderRadius="xl"
              h="44px"
              flex={1.5}
              fontSize="sm"
              fontWeight="700"
              onClick={handleCropSaveLocal}
              _hover={{ bg: "chocolate.600" }}
              cursor="pointer"
            >
              Apply Crop
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}
