import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Flex, Heading, Text, Button } from "@chakra-ui/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error Boundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isMimeError =
        this.state.error?.message?.includes("MIME type") ||
        this.state.error?.message?.includes("dynamically imported") ||
        this.state.error?.name === "TypeError";

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
            p={8}
            bg="white"
            borderRadius="2xl"
            maxW="480px"
            w="100%"
            border="1.5px solid var(--c-outline)"
            boxShadow="var(--shadow-card)"
          >
            <Box
              as="span"
              className="material-symbols-outlined"
              fontSize="48px"
              color="var(--c-chocolate)"
              mb={4}
            >
              sync_problem
            </Box>
            <Heading size="lg" mb={2} color="brand.900" fontFamily="serif">
              {isMimeError ? "New Build Manifest Loaded" : "Something went wrong"}
            </Heading>
            <Text fontSize="sm" color="fg.muted" mb={6}>
              {isMimeError
                ? "The application was updated with new assets. Please reload to refresh your browser cache."
                : "An unexpected error occurred while loading this page."}
            </Text>
            <Button
              bg="var(--c-lagoon)"
              color="white"
              borderRadius="xl"
              px={6}
              py={3}
              cursor="pointer"
              onClick={() => {
                sessionStorage.clear();
                window.location.reload();
              }}
              _hover={{ bg: "brand.900" }}
            >
              Reload Application
            </Button>
          </Box>
        </Flex>
      );
    }

    return this.props.children;
  }
}
