import type { ReactNode } from "react"

import { ChakraProvider } from "@chakra-ui/react"

import { system } from "@/theme/system"

type ProviderProps = {
  children: ReactNode
}

export function Provider({ children }: ProviderProps) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>
}