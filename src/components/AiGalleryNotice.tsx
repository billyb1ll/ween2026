import { Box, Flex, HStack, Text, Button, Badge } from "@chakra-ui/react";
import { Link } from "react-router-dom";

export function AiGalleryNotice() {
  return (
    <Box
      mb={5}
      p={{ base: 4, md: 4.5 }}
      bg="rgba(73, 98, 104, 0.04)"
      borderRadius="2xl"
      border="1px solid"
      borderColor="border.subtle"
      position="relative"
      overflow="hidden"
      boxShadow="0 2px 10px rgba(0,0,0,0.02)"
    >
      {/* Brand accent side line */}
      <Box
        position="absolute"
        left={0}
        top={0}
        bottom={0}
        w="4px"
        bg="brand.solid"
      />

      <Flex
        direction={{ base: "column", sm: "row" }}
        align={{ base: "flex-start", sm: "center" }}
        justify="space-between"
        gap={4}
        pl={1}
      >
        <HStack gap={3.5} align="flex-start" flex={1}>
          <Flex
            w="38px"
            h="38px"
            borderRadius="xl"
            bg="brand.solid"
            color="white"
            align="center"
            justify="center"
            flexShrink={0}
            boxShadow="0 4px 12px rgba(73,98,104,0.25)"
          >
            <Box as="span" className="material-symbols-outlined" fontSize="20px">
              auto_awesome
            </Box>
          </Flex>

          <Box flex={1}>
            <HStack gap={2} mb={1} flexWrap="wrap">
              <Text fontSize="sm" fontWeight="700" color="brand.900">
                AI Detection & Full Gallery Notice
              </Text>
              <Badge colorPalette="teal" variant="subtle" size="xs" px={2.5} py={0.5} borderRadius="full" fontWeight="700">
                AI Recognition Notice
              </Badge>
            </HStack>

            <Text fontSize="xs" color="fg.muted" lineHeight="1.5">
              AI automatically matches photos of your claimed face. Because specific lighting or side angles might occasionally be missed, select{" "}
              <Text as="span" fontWeight="700" color="brand.900">
                "✨ Unseen Photos"
              </Text>{" "}
              in the dropdown or explore the full event gallery directly.
            </Text>
          </Box>
        </HStack>

        <Button
          asChild
          size="sm"
          variant="outline"
          borderRadius="xl"
          borderColor="brand.solid"
          color="brand.900"
          fontWeight="600"
          fontSize="xs"
          px={4}
          h="36px"
          flexShrink={0}
          _hover={{
            bg: "brand.solid",
            color: "white",
            borderColor: "brand.solid",
            transform: "translateY(-1px)",
          }}
          transition="all 0.2s"
        >
          <Link to="/gallery">
            <Box as="span" className="material-symbols-outlined" fontSize="16px" mr={1.5}>
              grid_view
            </Box>
            Browse Full Gallery
          </Link>
        </Button>
      </Flex>
    </Box>
  );
}
