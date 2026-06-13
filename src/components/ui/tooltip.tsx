import { Tooltip as ChakraTooltip, Portal } from "@chakra-ui/react"
import * as React from "react"

export interface TooltipProps {
  label: React.ReactNode
  children: React.ReactElement
  disabled?: boolean
}

export function Tooltip({ label, children, disabled }: TooltipProps) {
  if (disabled) return children

  return (
    <ChakraTooltip.Root>
      <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
      <Portal>
        <ChakraTooltip.Content
          bg="var(--c-chocolate)"
          color="white"
          fontSize="2xs"
          px={3}
          py={1.5}
          borderRadius="md"
          boxShadow="md"
          maxW="240px"
          zIndex={5000}
        >
          <ChakraTooltip.Arrow />
          {label}
        </ChakraTooltip.Content>
      </Portal>
    </ChakraTooltip.Root>
  )
}
