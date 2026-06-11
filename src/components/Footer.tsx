import { Box, Flex, HStack, Text } from '@chakra-ui/react'

const socialLinks = [
  { name: 'Instagram', icon: 'photo_camera', href: '#' },
  { name: 'Facebook', icon: 'group', href: '#' },
  { name: 'Twitter', icon: 'tag', href: '#' },
]

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
      pb={{ base: 'calc(var(--dock-height) + 32px)', md: 12 }}
    >
      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align="center"
        maxW="var(--container-max)"
        mx="auto"
        px={{ base: 5, md: 16 }}
        gap={4}
      >
        <Text fontFamily="heading" fontSize="lg" fontWeight="600" color="accent.solid">
          Baan 7
        </Text>

        <Text fontSize="sm" color="fg.subtle" textAlign={{ base: 'center', md: 'left' }}>
          Made with 🤍 by Baan 7 Staff
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
              <Text display={{ base: 'none', sm: 'block' }}>{name}</Text>
            </Flex>
          ))}
        </HStack>
      </Flex>
    </Box>
  )
}
