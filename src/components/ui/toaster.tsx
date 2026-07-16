/* eslint-disable react-refresh/only-export-components */
"use client"

import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react"

export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
})

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root
            width={{ md: "sm" }}
            bg="rgba(252, 249, 248, 0.85)"
            backdropFilter="blur(12px)"
            border="1.5px solid"
            borderColor="accent.solid"
            borderRadius="xl"
            boxShadow="var(--shadow-card)"
            p={4}
            color="fg.default"
            display="flex"
            gap={3}
            alignItems="center"
            style={{
              animation: "scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            {toast.type === "loading" ? (
              <Spinner size="sm" color="brand.900" />
            ) : (
              <Toast.Indicator color="brand.900" />
            )}
            <Stack gap="0.5" flex="1" maxWidth="100%">
              {toast.title && (
                <Toast.Title color="brand.900" fontWeight="700" fontSize="sm">
                  {toast.title}
                </Toast.Title>
              )}
              {toast.description && (
                <Toast.Description color="fg.muted" fontSize="xs">
                  {toast.description}
                </Toast.Description>
              )}
            </Stack>
            {toast.action && (
              <Toast.ActionTrigger color="brand.900" fontWeight="600" fontSize="xs">
                {toast.action.label}
              </Toast.ActionTrigger>
            )}
            {toast.closable && <Toast.CloseTrigger color="fg.muted" />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}
