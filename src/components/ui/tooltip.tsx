import { Tooltip as ChakraTooltip, Portal } from "@chakra-ui/react"
import * as React from "react"

export interface TooltipProps {
  label: React.ReactNode
  children: React.ReactElement
  disabled?: boolean
}

export function Tooltip({ label, children, disabled }: TooltipProps) {
  if (disabled || !label) return children

  return (
    <ChakraTooltip.Root openDelay={150} closeDelay={100}>
      <ChakraTooltip.Trigger asChild>
        <span style={{ display: "inline-flex", cursor: "help" }}>{children}</span>
      </ChakraTooltip.Trigger>
      <Portal>
        <ChakraTooltip.Content
          bg="#1b1c1c"
          color="white"
          fontSize="2xs"
          fontWeight="600"
          px={3}
          py={1.5}
          borderRadius="8px"
          boxShadow="0 8px 24px -4px rgba(0,0,0,0.3)"
          maxW="300px"
          zIndex={9999}
        >
          <ChakraTooltip.Arrow />
          {label}
        </ChakraTooltip.Content>
      </Portal>
    </ChakraTooltip.Root>
  )
}
