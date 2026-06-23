import { useState } from "react";
import {
  Dialog,
  Button,
  VStack,
  Text,
  Heading,
  Box,
} from "@chakra-ui/react";
import { useUser } from "../context/UserContext";

export function TermsOfUseModal() {
  const { user, acceptTos } = useUser();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If there's no user, or they already accepted, don't show anything.
  if (!user || user.has_accepted_tos) {
    return null;
  }

  const handleAccept = async () => {
    if (!agreed) return;
    setSubmitting(true);
    await acceptTos();
    setSubmitting(false);
  };

  return (
    <Dialog.Root
      open={true}
      placement="center"
      closeOnInteractOutside={false}
      closeOnEscape={false}
    >
      <Dialog.Backdrop
        bg="color-mix(in srgb, var(--c-ink) 80%, transparent)"
        backdropFilter="blur(8px)"
      />
      <Dialog.Positioner zIndex={2000} px={4}>
        <Dialog.Content
          bg="var(--c-ivory)"
          border={{ base: "none", md: "2px solid var(--c-chocolate)" }}
          borderRadius="2xl"
          width={{ base: "100%", md: "640px" }}
          maxH="90vh"
          p={8}
          boxShadow="var(--shadow-card)"
          display="flex"
          flexDirection="column"
          position="relative"
        >
          <Dialog.Header p={0} mb={6}>
            <Heading
              fontFamily="heading"
              fontSize="2xl"
              fontWeight="700"
              color="var(--c-chocolate)"
              textAlign="center"
            >
              Terms of Use & Privacy Policy<br />
              ข้อตกลงและนโยบายความเป็นส่วนตัว
            </Heading>
          </Dialog.Header>

          <Dialog.Body p={0} flex={1} overflowY="auto">
            <VStack align="stretch" gap={6}>
              <Box
                bg="white"
                p={5}
                borderRadius="xl"
                border="1px solid"
                borderColor="border.subtle"
              >
                <Text fontSize="sm" fontWeight="700" color="var(--c-chocolate)" mb={2}>
                  1. Photo & Media Usage (การใช้รูปภาพและสื่อ)
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  By using this platform, you agree that any photos uploaded (e.g., for your Vibe Check profile or Gallery) may be used within the context of the Baan 7 Orientation events. We reserve the right to display, modify, or moderate these photos for the safety and enjoyment of all members.
                  <br /><br />
                  เมื่อใช้แพลตฟอร์มนี้ คุณตกลงว่ารูปภาพที่อัปโหลดอาจถูกนำไปใช้ในกิจกรรมปฐมนิเทศของบ้าน 7 เราขอสงวนสิทธิ์ในการแสดง แก้ไข หรือตรวจสอบรูปภาพเหล่านี้เพื่อความปลอดภัยของทุกคน
                </Text>
              </Box>

              <Box
                bg="white"
                p={5}
                borderRadius="xl"
                border="1px solid"
                borderColor="border.subtle"
              >
                <Text fontSize="sm" fontWeight="700" color="var(--c-chocolate)" mb={2}>
                  2. Security & Password Storage (ความปลอดภัยและรหัสผ่าน)
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  The system <strong>does not store raw passwords or PINs</strong>. All authentication relies on secure modern hashing algorithms. Your account is bound to your Student ID and should not be shared.
                  <br /><br />
                  ระบบ <strong>ไม่บันทึกรหัสผ่านหรือ PIN ของคุณ</strong> การยืนยันตัวตนทั้งหมดใช้ระบบเข้ารหัสที่ปลอดภัย บัญชีของคุณผูกกับรหัสนิสิตและไม่ควรแชร์ให้ผู้อื่น
                </Text>
              </Box>

              <Box
                bg="white"
                p={5}
                borderRadius="xl"
                border="1px solid"
                borderColor="border.subtle"
              >
                <Text fontSize="sm" fontWeight="700" color="var(--c-chocolate)" mb={2}>
                  3. PDPA & Data Privacy (นโยบายคุ้มครองข้อมูลส่วนบุคคล)
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  We process your data (Name, Faculty, Major, IG, Bio) solely to facilitate your participation in Baan 7 activities. You may request account deletion at any time by contacting a moderator.
                  <br /><br />
                  เราประมวลผลข้อมูลของคุณ (ชื่อ คณะ สาขา IG ประวัติย่อ) เพื่อประกอบการเข้าร่วมกิจกรรมบ้าน 7 เท่านั้น คุณสามารถแจ้งลบบัญชีได้ตลอดเวลาผ่านทางผู้ดูแลระบบ
                </Text>
              </Box>

              {/* Custom Checkbox as standard Checkbox might require more setup with Chakra v3 */}
              <Box
                as="label"
                display="flex"
                alignItems="center"
                gap={3}
                cursor="pointer"
                p={4}
                bg={agreed ? "rgba(73, 98, 104, 0.1)" : "transparent"}
                border="2px solid"
                borderColor={agreed ? "var(--c-lagoon)" : "border.subtle"}
                borderRadius="xl"
                transition="all 0.2s"
                _hover={{ bg: "rgba(73, 98, 104, 0.05)" }}
                _focusWithin={{ ring: "2px", ringColor: "var(--c-chocolate)", ringOffset: "2px" }}
              >
                <input
                  type="checkbox"
                  aria-label="I agree to the Terms of Use"
                  checked={agreed}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgreed(e.target.checked)}
                  className="tos-checkbox"
                />
                <Text fontSize="sm" fontWeight="600" color="var(--c-ink)">
                  I have read and agree to the Terms of Use.<br />
                  ฉันได้อ่านและยอมรับข้อตกลงการใช้งาน
                </Text>
              </Box>
            </VStack>
          </Dialog.Body>

          <Dialog.Footer p={0} mt={6} pt={6} borderTop="1px solid" borderColor="border.subtle">
            <Button
              w="100%"
              h="56px"
              bg="var(--c-chocolate)"
              color="white"
              borderRadius="xl"
              fontSize="lg"
              fontWeight="700"
              disabled={!agreed || submitting}
              loading={submitting}
              cursor={agreed ? "pointer" : "not-allowed"}
              onClick={handleAccept}
              _hover={{ bg: "chocolate.600" }}
            >
              Accept & Continue (ยอมรับและเข้าสู่ระบบ)
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
