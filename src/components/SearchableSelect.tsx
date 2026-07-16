import { useState, useMemo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Portal,
  InputGroup,
  Combobox,
  createListCollection,
} from "@chakra-ui/react";
import { FiSearch, FiChevronDown } from "react-icons/fi";

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
  searchPlaceholder = "Type to search...",
  id,
  "aria-label": ariaLabel,
  title,
}: SearchableSelectProps) {
  const [filterQuery, setFilterQuery] = useState("");

  const stringifiedOptions = JSON.stringify(options);
  const stableOptions = useMemo(() => {
    return options.map(opt => ({
      value: opt.value === "" ? "__EMPTY__" : opt.value,
      label: opt.primaryText,
      secondaryText: opt.secondaryText,
      badge: opt.badge,
      originalValue: opt.value,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stringifiedOptions]);

  const filteredOptions = useMemo(() => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return stableOptions;
    return stableOptions.filter((opt) =>
      opt.label.toLowerCase().includes(q) ||
      (opt.secondaryText && opt.secondaryText.toLowerCase().includes(q)) ||
      (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [stableOptions, filterQuery]);

  const collection = useMemo(() => {
    return createListCollection({
      items: filteredOptions,
      itemToString: (item) => item.label,
      itemToValue: (item) => item.value,
    });
  }, [filteredOptions]);

  const memoizedValue = useMemo(() => {
    return value != null && value !== undefined ? [value === "" ? "__EMPTY__" : value] : [];
  }, [value]);

  return (
    <Box position="relative" w="full">
      <Combobox.Root
        collection={collection}
        value={memoizedValue}
        onValueChange={(details) => {
          if (!details.value || details.value.length === 0) {
            // Guard against Ark UI clearing on blur when it shouldn't.
            if (!filterQuery.trim()) {
              onChange("");
            }
            return;
          }
          if (details.items && details.items.length > 0) {
             onChange(details.items[0].originalValue);
          } else {
             const raw = details.value[0];
             onChange(raw === "__EMPTY__" ? "" : raw);
          }
        }}
        onInputValueChange={(details) => {
          setFilterQuery(details.inputValue);
        }}
        onOpenChange={(details) => {
          if (details.open) {
            setFilterQuery("");
          }
        }}
        openOnClick
        positioning={{ sameWidth: true }}
        width="100%"
      >
        <Combobox.Control position="relative" width="100%">
          <InputGroup
            startElement={<FiSearch color="gray.400" />}
            w="full"
          >
            <Combobox.Input
              id={id}
              aria-label={ariaLabel}
              title={title}
              placeholder={placeholder}
              borderRadius="xl"
              bg="var(--c-ivory)"
              h="44px"
              w="100%"
              border="1.5px solid var(--c-outline)"
              pl="36px"
              pr="36px"
              fontSize="sm"
              _focus={{
                borderColor: "accent.solid",
                boxShadow: "0 0 0 1px var(--chakra-colors-accent-solid)",
              }}
            />
          </InputGroup>
          <Combobox.Trigger
            position="absolute"
            right="10px"
            top="50%"
            transform="translateY(-50%)"
            zIndex="2"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="fg.muted"
            cursor="pointer"
            bg="transparent"
            border="none"
            p={1}
          >
            <FiChevronDown />
          </Combobox.Trigger>
        </Combobox.Control>
        <Portal>
          <Combobox.Positioner zIndex={4000} style={{ zIndex: 9999 }}>
            <Combobox.Content
              bg="bg.surface"
              borderRadius="xl"
              border="1px solid"
              borderColor="border.subtle"
              boxShadow="md"
              maxH="280px"
              overflowY="auto"
              py={1}
            >
              <Combobox.Empty fontSize="sm" p={3} textAlign="center" color="fg.muted">
                {searchPlaceholder.includes("ค้นหา")
                  ? "ไม่พบข้อมูล / No results found"
                  : "No results found"}
              </Combobox.Empty>
              {collection.items.map((item) => {
                const isSelected = item.originalValue === value;
                return (
                  <Combobox.Item
                    key={item.value}
                    item={item}
                    cursor="pointer"
                    px={3}
                    py={2}
                    fontSize="sm"
                    transition="background 0.2s"
                    _hover={{ bg: "rgba(73, 98, 104, 0.08)" }}
                    _selected={{ bg: "accent.solid", color: "brand.900" }}
                  >
                    <HStack justify="space-between" w="100%">
                      <VStack align="start" gap={0}>
                        <Text fontWeight="medium" color={isSelected ? "white" : "fg.default"}>
                          {item.label}
                        </Text>
                        {item.secondaryText && (
                          <Text fontSize="xs" color={isSelected ? "whiteAlpha.800" : "fg.muted"}>
                            {item.secondaryText}
                          </Text>
                        )}
                      </VStack>
                      {item.badge && (
                        <Badge
                          colorPalette={isSelected ? "green" : "gray"}
                          variant={isSelected ? "solid" : "subtle"}
                          color={isSelected ? "var(--chakra-colors-accent-solid)" : undefined}
                          bg={isSelected ? "white" : undefined}
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </HStack>
                  </Combobox.Item>
                );
              })}
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
    </Box>
  );
}
