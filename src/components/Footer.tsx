import { Box, Flex, Text, Link } from "@chakra-ui/react";

export function Footer() {
  return (
    <Box
      as="footer"
      w="100%"
      py={{ base: 6, md: 8 }}
      mt={{ base: 8, md: 16 }}
      borderTop="1px solid"
      borderColor="chocolate.100"
      bg="chocolate.50"
      pb={{ base: "calc(var(--dock-height) + 24px)", md: 8 }}
    >
      <Flex
        direction={{ base: "column", sm: "row" }}
        justify="space-between"
        align="center"
        maxW="var(--container-max)"
        mx="auto"
        px={{ base: 6, md: 16 }}
        gap={4}
      >
        <Text
          fontFamily="heading"
          fontSize="md"
          fontWeight="700"
          color="chocolate.800"
        >
          Baan 7
        </Text>

        <Text
          fontSize="xs"
          fontWeight="600"
          color="chocolate.600"
          textAlign={{ base: "center", sm: "right" }}
        >
          Developed by{" "}
          <Link
            href="https://www.instagram.com/billy.b1lll/"
            target="_blank"
            rel="noopener noreferrer"
            color="chocolate.700"
            fontWeight="700"
            _hover={{
              color: "chocolate.900",
              textDecoration: "underline",
            }}
          >
            P'Billy
          </Link>
          {" • "}
          <Link
            href="https://www.instagram.com/veryween.mu?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
            target="_blank"
            rel="noopener noreferrer"
            color="chocolate.700"
            fontWeight="700"
            _hover={{
              color: "chocolate.900",
              textDecoration: "underline",
            }}
          >
            @veryween.mu
          </Link>
        </Text>
      </Flex>
    </Box>
  );
}
