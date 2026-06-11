import { Box, VStack, Text, Center } from '@chakra-ui/react'

export const LoadingFallback = () => {
  return (
    <Center position="fixed" inset={0} bg="#FAFAF7" zIndex={9999}>
      <VStack gap={4} align="center">
        {/* Dual-tone Baan 7 Spinner */}
        <Box
          w="48px"
          h="48px"
          border="4px solid rgba(197, 224, 230, 0.3)"
          borderTopColor="#4A2B17"
          borderRadius="full"
          style={{
            animation: 'spin 0.8s linear infinite',
          }}
        />
        {/* Breathing Brand Text */}
        <Text
          fontFamily='"Playfair Display", Georgia, serif'
          color="#4A2B17"
          fontSize="lg"
          fontWeight="600"
          letterSpacing="0.05em"
          style={{
            animation: 'breath 2.0s ease-in-out infinite',
          }}
        >
          Preparing Baan 7...
        </Text>
      </VStack>
    </Center>
  )
}
