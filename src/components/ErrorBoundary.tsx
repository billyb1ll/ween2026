import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Flex, Heading, Text, Button, Badge } from "@chakra-ui/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error Boundary caught an error:", error, errorInfo);
  }

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || "";
      const errorName = this.state.error?.name || "";

      const isMimeError =
        errorMessage.includes("MIME type") ||
        errorMessage.includes("dynamically imported") ||
        errorMessage.includes("Importing a module script failed");

      const isNetworkError =
        !navigator.onLine ||
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("Load failed") ||
        errorMessage.includes("Network request failed") ||
        errorName === "TypeError";

      return (
        <Flex
          minH="100vh"
          align="center"
          justify="center"
          p={6}
          bg="var(--c-ivory)"
          direction="column"
          textAlign="center"
        >
          <Box
            p={{ base: 6, md: 8 }}
            bg="white"
            borderRadius="2xl"
            maxW="520px"
            w="100%"
            border="1.5px solid var(--c-outline)"
            boxShadow="var(--shadow-card)"
          >
            <Box
              as="span"
              className="material-symbols-outlined"
              fontSize="48px"
              color={isNetworkError ? "var(--c-chocolate)" : "var(--c-chocolate)"}
              mb={3}
            >
              {isNetworkError ? "wifi_off" : "sync_problem"}
            </Box>

            {isNetworkError && (
              <Badge
                colorPalette="amber"
                variant="subtle"
                px={3}
                py={1}
                borderRadius="full"
                fontSize="xs"
                fontWeight="700"
                mb={3}
                display="inline-flex"
                alignItems="center"
                gap={1.5}
              >
                <Box as="span" className="material-symbols-outlined" fontSize="14px">
                  wifi_tethering_off
                </Box>
                NETWORK / MU-WIFI BLOCK
              </Badge>
            )}

            <Heading size="lg" mb={2} color="brand.900" fontFamily="serif">
              {isNetworkError
                ? "Connection Issue Detected"
                : isMimeError
                ? "New Build Manifest Loaded"
                : "Something went wrong"}
            </Heading>

            <Text fontSize="sm" color="fg.muted" mb={4} lineHeight={1.6}>
              {isNetworkError ? (
                <>
                  If you are connected to <strong>MU-WiFi</strong> or campus Wi-Fi, the network firewall may block server connections. Please switch to cellular data (4G/5G) or a different Wi-Fi network.
                  <br />
                  <Text as="span" display="block" mt={2} fontSize="xs" color="fg.subtle">
                    หากใช้งาน <strong>MU-WiFi</strong> หรือ Wi-Fi มหาวิทยาลัย ระบบอาจถูกบล็อก กรุณาสลับไปใช้อินเทอร์เน็ตมือถือ (4G/5G) หรือ Wi-Fi อื่น แล้วลองใหม่อีกครั้ง
                  </Text>
                </>
              ) : isMimeError ? (
                "The application was updated with new assets. Please reload to refresh your browser cache."
              ) : (
                "An unexpected error occurred while loading this page."
              )}
            </Text>

            <Flex direction="column" gap={3} align="center">
              <Button
                bg="var(--c-lagoon)"
                color="white"
                borderRadius="xl"
                px={6}
                py={3}
                w="100%"
                cursor="pointer"
                onClick={() => {
                  sessionStorage.clear();
                  window.location.reload();
                }}
                _hover={{ bg: "brand.900" }}
              >
                Reload Application
              </Button>

              <Button
                size="xs"
                variant="ghost"
                color="fg.subtle"
                onClick={this.toggleDetails}
              >
                {this.state.showDetails ? "Hide Technical Details" : "Show Technical Details"}
              </Button>
            </Flex>

            {this.state.showDetails && (
              <Box
                mt={4}
                p={3}
                bg="gray.900"
                color="red.300"
                borderRadius="lg"
                textAlign="left"
                fontSize="xs"
                fontFamily="mono"
                maxH="200px"
                overflowY="auto"
                wordBreak="break-word"
              >
                <Text fontWeight="bold" color="red.400">
                  {errorName}: {errorMessage || "Unknown error"}
                </Text>
                {this.state.error?.stack && (
                  <Text fontSize="2xs" color="gray.400" mt={2} whiteSpace="pre-wrap">
                    {this.state.error.stack}
                  </Text>
                )}
              </Box>
            )}
          </Box>
        </Flex>
      );
    }

    return this.props.children;
  }
}

