import { useState } from "react";
import {
  Box,
  Input,
  VStack,
  HStack,
  Text,
  Badge,
  Popover,
  Portal,
  InputGroup,
} from "@chakra-ui/react";
import { FiSearch } from "react-icons/fi";

export interface SelectOption {
  value: string;
  primaryText: string;
  secondaryText?: string;
  badge?: string;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  id?: string;
  "aria-label"?: string;
  title?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select option...",
  searchPlaceholder = "พิมพ์ค้นหา / Type to search...",
  id,
  "aria-label": ariaLabel,
  title,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [typedQuery, setTypedQuery] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const selectedOption = options.find(
    (o) =>
      o.value === value ||
      o.primaryText === value ||
      (o.secondaryText && o.secondaryText === value)
  );
  const displayValue =
    typedQuery !== null
      ? typedQuery
      : selectedOption
      ? selectedOption.primaryText
      : "";

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    setHighlightedIndex(-1);
    if (!open) {
      setTypedQuery(null);
    } else if (typedQuery === null) {
      setTypedQuery(selectedOption ? selectedOption.primaryText : "");
    }
  };

  const filteredOptions = options.filter((opt) => {
    const q = (typedQuery !== null ? typedQuery : "").toLowerCase().trim();
    if (!q) return true;
    return (
      opt.primaryText.toLowerCase().includes(q) ||
      (opt.secondaryText && opt.secondaryText.toLowerCase().includes(q)) ||
      (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  });

  return (
    <Box position="relative" w="full">
      <Popover.Root
        open={isOpen}
        onOpenChange={(e) => handleOpenChange(e.open)}
        positioning={{ sameWidth: true, offset: { mainAxis: 4 } }}
        autoFocus={false}
      >
        <Popover.Trigger asChild>
          <InputGroup
            startElement={<FiSearch color="gray.400" />}
            w="full"
          >
            <Input
              id={id}
              aria-label={ariaLabel}
              title={title}
              placeholder={placeholder}
              value={displayValue}
              onChange={(e) => {
                setTypedQuery(e.target.value);
                setIsOpen(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => {
                setIsOpen(true);
                if (typedQuery === null) {
                  setTypedQuery(selectedOption ? selectedOption.primaryText : "");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (!isOpen) {
                    setIsOpen(true);
                  } else {
                    setHighlightedIndex((prev) =>
                      Math.min(prev + 1, filteredOptions.length - 1)
                    );
                  }
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  if (isOpen) {
                    setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                  }
                } else if (e.key === "Enter") {
                  if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                    e.preventDefault();
                    const selectedOpt = filteredOptions[highlightedIndex];
                    onChange(selectedOpt.value);
                    setTypedQuery(null);
                    setIsOpen(false);
                    setHighlightedIndex(-1);
                  }
                } else if (e.key === "Escape") {
                  setIsOpen(false);
                  setTypedQuery(null);
                  setHighlightedIndex(-1);
                }
              }}
              borderRadius="xl"
              bg="var(--c-ivory)"
              borderColor="var(--c-outline)"
              _focus={{
                borderColor: "var(--c-chocolate)",
                boxShadow: "0 0 0 1px var(--c-chocolate)",
              }}
            />
          </InputGroup>
        </Popover.Trigger>

        <Portal>
          <Popover.Positioner zIndex={2000}>
            <Popover.Content
              bg="bg.surface"
              borderRadius="xl"
              border="1px solid"
              borderColor="border.subtle"
              boxShadow="md"
              overflow="hidden"
            >
              <Popover.Body p={0}>
                <Box maxH="300px" overflowY="auto">
                  {filteredOptions.length === 0 ? (
                    <Box p={4} textAlign="center" color="fg.muted" fontSize="sm">
                      {searchPlaceholder.includes("ค้นหา")
                        ? "ไม่พบข้อมูล / No results found"
                        : "No results found"}
                    </Box>
                  ) : (
                    filteredOptions.map((opt, idx) => {
                      const isSelected = opt.value === value;
                      const isHighlighted = idx === highlightedIndex;
                      const isHighlightedOrSelected = isSelected || isHighlighted;
                      return (
                        <HStack
                          key={opt.value}
                          justify="space-between"
                          p={3}
                          cursor="pointer"
                          transition="all 0.2s"
                          bg={isHighlightedOrSelected ? "var(--c-chocolate)" : "transparent"}
                          _hover={{
                            bg: isHighlightedOrSelected
                              ? "color-mix(in srgb, var(--c-chocolate) 90%, black)"
                              : "rgba(73, 98, 104, 0.08)",
                          }}
                          onClick={() => {
                            onChange(opt.value);
                            setTypedQuery(null);
                            setIsOpen(false);
                            setHighlightedIndex(-1);
                          }}
                        >
                          <VStack align="start" gap={0}>
                            <Text
                              fontWeight="medium"
                              color={isHighlightedOrSelected ? "white" : "fg.default"}
                            >
                              {opt.primaryText}
                            </Text>
                            {opt.secondaryText && (
                              <Text
                                fontSize="sm"
                                color={isHighlightedOrSelected ? "whiteAlpha.800" : "fg.muted"}
                              >
                                {opt.secondaryText}
                              </Text>
                            )}
                          </VStack>
                          {opt.badge && (
                            <Badge
                              colorPalette={isHighlightedOrSelected ? "green" : "gray"}
                              variant={isHighlightedOrSelected ? "solid" : "subtle"}
                              color={isHighlightedOrSelected ? "var(--c-chocolate)" : undefined}
                              bg={isHighlightedOrSelected ? "white" : undefined}
                            >
                              {opt.badge}
                            </Badge>
                          )}
                        </HStack>
                      );
                    })
                  )}
                </Box>
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    </Box>
  );
}
