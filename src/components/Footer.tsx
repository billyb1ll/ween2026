import { Box, Flex, HStack, Text, Link } from "@chakra-ui/react";

const socialLinks = [
  {
    name: "Instagram",
    icon: "photo_camera",
    href: "https://www.instagram.com/veryween.mu?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
  },
];

export function Footer() {
  return (
    <Box
      as="footer"
      w="100%"
      py={{ base: 8, md: 12 }}
      mt={{ base: 8, md: 20 }}
      borderTop="1px solid"
      borderColor="border.subtle"
      bg="bg.canvas"
      pb={{ base: "calc(var(--dock-height) + 32px)", md: 12 }}
    >
      <Flex
        direction={{ base: "column", md: "row" }}
        justify="space-between"
        align="center"
        maxW="var(--container-max)"
        mx="auto"
        px={{ base: 5, md: 16 }}
        gap={4}
      >
        <Text
          fontFamily="heading"
          fontSize="lg"
          fontWeight="600"
          color="accent.solid"
        >
          Baan 7
        </Text>

        <Text
          fontSize="sm"
          color="fg.subtle"
          textAlign={{ base: "center", md: "left" }}
        >
          Developed by {` `}
          <Link
            href="https://www.instagram.com/billy.b1lll/"
            target="_blank"
            rel="noopener noreferrer"
            color="accent.solid"
            fontWeight="600"
            _hover={{
              textDecoration: "underline",
            }}
          >
            P'Billy
          </Link>
        </Text>

        <HStack gap={4}>
          {socialLinks.map(({ name, icon }) => (
            <Flex
              key={name}
              as="span"
              role="img"
              aria-label={name}
              align="center"
              gap={1.5}
              fontSize="xs"
              fontWeight="600"
              letterSpacing="0.05em"
              color="fg.subtle"
              cursor="default"
            >
              <Box className="material-symbols-outlined" fontSize="md">
                {icon}
              </Box>
              <Text display={{ base: "none", sm: "block" }}>{name}</Text>
            </Flex>
          ))}
        </HStack>
      </Flex>
    </Box>
  );
}
