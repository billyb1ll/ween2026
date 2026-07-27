import React, { useRef } from "react";
import { FiChevronUp } from "react-icons/fi";
import {
  Box,
  Heading,
  Flex,
  Input,
  Button,
  VStack,
  Text,
  Tabs,
  Table,
  Badge,
  HStack,
} from "@chakra-ui/react";
import { Tooltip } from "../ui/tooltip";
import { SearchableSelect } from "../SearchableSelect";
import type { DBUser } from "../../pages/AdminDashboardPage";

interface WhitelistTableProps {
  whitelistedUsers: DBUser[];
  selectedStudentIds: string[];
  lastUpdatedStudentId: string | null;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  whitelistRoleTab: "student" | "staff";
  setWhitelistRoleTab: (val: "student" | "staff") => void;
  newStudentId: string;
  setNewStudentId: (val: string) => void;
  newRole: string;
  setNewRole: (val: string) => void;
  isAllSelected: boolean;
  handleSelectAll: (checked: boolean) => void;
  handleSelectUser: (id: string, checked: boolean) => void;
  handleInspectUser: (u: DBUser) => void;
  setUserToDelete: (id: string | null) => void;
  handleAddWhitelist: (e: React.FormEvent) => void;
  handleCSVUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getRoleDescription: (role: string) => string;
}

export function WhitelistTable({
  whitelistedUsers,
  selectedStudentIds,
  lastUpdatedStudentId,
  searchQuery,
  setSearchQuery,
  whitelistRoleTab,
  setWhitelistRoleTab,
  newStudentId,
  setNewStudentId,
  newRole,
  setNewRole,
  isAllSelected,
  handleSelectAll,
  handleSelectUser,
  handleInspectUser,
  setUserToDelete,
  handleAddWhitelist,
  handleCSVUpload,
  getRoleDescription,
}: WhitelistTableProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortMode, setSortMode] = React.useState<string>("id-asc");

  const filteredWhitelistedUsers = whitelistedUsers.filter((u) => {
    const roleMatch =
      whitelistRoleTab === "student"
        ? u.role === "student"
        : u.role !== "student";
    if (!roleMatch) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      u.student_id.toLowerCase().includes(q) ||
      (u.nickname && u.nickname.toLowerCase().includes(q)) ||
      (u.faculty && u.faculty.toLowerCase().includes(q))
    );
  });

  const sortedAndFilteredUsers = React.useMemo(() => {
    return [...filteredWhitelistedUsers].sort((a, b) => {
      if (sortMode === "id-asc") {
        return a.student_id.localeCompare(b.student_id);
      }
      if (sortMode === "id-desc") {
        return b.student_id.localeCompare(a.student_id);
      }
      if (sortMode === "name-asc") {
        const nameA = a.nickname || "";
        const nameB = b.nickname || "";
        return nameA.localeCompare(nameB, "th");
      }
      if (sortMode === "name-desc") {
        const nameA = a.nickname || "";
        const nameB = b.nickname || "";
        return nameB.localeCompare(nameA, "th");
      }
      if (sortMode === "faculty-asc") {
        const facA = a.faculty || "";
        const facB = b.faculty || "";
        return facA.localeCompare(facB, "th");
      }
      if (sortMode === "faculty-desc") {
        const facA = a.faculty || "";
        const facB = b.faculty || "";
        return facB.localeCompare(facA, "th");
      }
      if (sortMode === "house-asc") {
        const houseA = a.house_position || "";
        const houseB = b.house_position || "";
        return houseA.localeCompare(houseB, "th");
      }
      if (sortMode === "house-desc") {
        const houseA = a.house_position || "";
        const houseB = b.house_position || "";
        return houseB.localeCompare(houseA, "th");
      }
      if (sortMode === "role-asc") {
        const roleA = a.role || "";
        const roleB = b.role || "";
        return roleA.localeCompare(roleB);
      }
      if (sortMode === "role-desc") {
        const roleA = a.role || "";
        const roleB = b.role || "";
        return roleB.localeCompare(roleA);
      }
      if (sortMode === "status-asc" || sortMode === "status") {
        const statusA = a.nickname ? 1 : 2;
        const statusB = b.nickname ? 1 : 2;
        if (statusA !== statusB) return statusA - statusB;
        return a.student_id.localeCompare(b.student_id);
      }
      if (sortMode === "status-desc") {
        const statusA = a.nickname ? 1 : 2;
        const statusB = b.nickname ? 1 : 2;
        if (statusA !== statusB) return statusB - statusA;
        return b.student_id.localeCompare(a.student_id);
      }
      return 0;
    });
  }, [filteredWhitelistedUsers, sortMode]);

  const handleSort = (field: string) => {
    if (sortMode === `${field}-asc`) {
      setSortMode(`${field}-desc`);
    } else {
      setSortMode(`${field}-asc`);
    }
  };

  const renderSortIcon = (field: string) => {
    const isAsc = sortMode === `${field}-asc`;
    const isDesc = sortMode === `${field}-desc`;
    const isActive = isAsc || isDesc;
    
    return (
      <Box
        as="span"
        w="16px"
        h="16px"
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        borderRadius="full"
        bg={isActive ? "brand.50" : "transparent"}
        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        transform={isDesc ? "rotate(180deg)" : "rotate(0deg)"}
        opacity={isActive ? 1 : 0}
        _groupHover={{ opacity: 1, bg: isActive ? "brand.50" : "gray.100" }}
      >
        <FiChevronUp size={12} color={isActive ? "var(--chakra-colors-brand-600)" : "var(--chakra-colors-gray-400)"} />
      </Box>
    );
  };

  const renderSortableHeader = (field: string, label: string, width?: string) => (
    <Table.ColumnHeader 
      width={width}
      fontFamily="heading" 
      cursor="pointer" 
      onClick={() => handleSort(field)} 
      userSelect="none"
      transition="all 0.2s"
      className="group"
      _hover={{ bg: "bg.muted" }}
    >
      <Flex align="center" gap={2}>
        <Text fontWeight="600" color="fg.muted" _groupHover={{ color: "brand.900" }} transition="color 0.2s">
          {label}
        </Text>
        {renderSortIcon(field)}
      </Flex>
    </Table.ColumnHeader>
  );

  return (
    <Box
      bg="var(--c-white)"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="xl"
      boxShadow="sm"
      p={6}
    >
      <Heading size="md" color="gray.700" fontFamily="heading" mb={4}>
        Student Whitelist
      </Heading>
      <Box>
        <Flex
          justify="space-between"
          align="center"
          mb={4}
          flexWrap="wrap"
          gap={3}
        >
          <Heading
            as="h3"
            fontSize="lg"
            fontWeight="700"
            fontFamily="heading"
            color="brand.900"
            m={0}
          >
            Student ID Whitelisting
          </Heading>

          {/* CSV Upload Inputs */}
          <Box>
            <Input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              ref={fileInputRef}
              display="none"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              bg="accent.solid"
              color="brand.900"
              h="44px"
              py={2}
              px={6}
              borderRadius="xl"
              cursor="pointer"
              _hover={{
                bg: "color-mix(in srgb, var(--chakra-colors-accent-solid) 85%, black)",
              }}
            >
              Upload CSV
            </Button>
          </Box>
        </Flex>

        <Flex
          as="form"
          onSubmit={handleAddWhitelist}
          gap={3}
          flexWrap="wrap"
          align="flex-start"
          mb={6}
        >
          <VStack align="start" gap={1}>
            <Text
              fontSize="xs"
              fontWeight="700"
              color="var(--c-muted)"
              textTransform="uppercase"
            >
              Student ID
            </Text>
            <Input
              placeholder="e.g. 6688225"
              value={newStudentId}
              onChange={(e) =>
                setNewStudentId(e.target.value.replace(/\D/g, ""))
              }
              h="44px"
              borderRadius="xl"
              border="1.5px solid var(--c-outline)"
              bg="var(--c-ivory)"
              w="180px"
              required
            />
          </VStack>
          <VStack align="start" gap={1} flex={1} minW="240px" maxW="340px">
            <Box
              fontSize="xs"
              fontWeight="700"
              color="var(--c-muted)"
              textTransform="uppercase"
            >
              <label htmlFor="add-user-role">Role Assignment</label>
            </Box>
            <SearchableSelect
              value={newRole}
              onChange={(val) => setNewRole(val)}
              options={[
                { value: "student", primaryText: "Student (Freshman)", badge: "STUDENT" },
                { value: "staff", primaryText: "Staff (General Ops)", badge: "STAFF" },
                { value: "moderator", primaryText: "Moderator (Full Access)", badge: "MOD" },
              ]}
              placeholder="Select Role..."
              searchPlaceholder="พิมพ์ค้นหาบทบาท / Type to search..."
            />
            <Text fontSize="3xs" color="fg.subtle">
              {getRoleDescription(newRole)}
            </Text>
          </VStack>
          <VStack align="start" gap={1}>
            <Box h="18px" />
            <Button
              type="submit"
              bg="var(--c-lagoon)"
              color="white"
              h="44px"
              py={2}
              px={6}
              borderRadius="xl"
              cursor="pointer"
              _hover={{
                bg: "color-mix(in srgb, var(--c-lagoon) 85%, black)",
              }}
            >
              Whitelist ID
            </Button>
          </VStack>
        </Flex>

        {/* Whitelist tab filters */}
        <Tabs.Root
          value={whitelistRoleTab}
          onValueChange={(details) =>
            setWhitelistRoleTab(details.value as "student" | "staff")
          }
          variant="line"
          mb={4}
        >
          <Tabs.List gap={6}>
            <Tabs.Trigger
              value="student"
              fontWeight="700"
              fontSize="sm"
              color={
                whitelistRoleTab === "student" ? "brand.900" : "var(--c-muted)"
              }
              _selected={{
                color: "brand.900",
                borderColor: "accent.solid",
              }}
            >
              Freshmen Only (
              {whitelistedUsers.filter((u) => u.role === "student").length})
            </Tabs.Trigger>
            <Tabs.Trigger
              value="staff"
              fontWeight="700"
              fontSize="sm"
              color={
                whitelistRoleTab === "staff" ? "brand.900" : "var(--c-muted)"
              }
              _selected={{
                color: "brand.900",
                borderColor: "accent.solid",
              }}
            >
              Staff & Moderators (
              {whitelistedUsers.filter((u) => u.role !== "student").length})
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>

        {/* Search & Counter Controls */}
        <Flex
          justify="space-between"
          align="center"
          mb={4}
          gap={4}
          flexWrap="wrap"
        >
          <HStack gap={3} flex={1} maxW="480px">
            <Box position="relative" flex={1}>
              <Box
                as="span"
                className="material-symbols-outlined"
                position="absolute"
                left="12px"
                top="50%"
                transform="translateY(-50%)"
                fontSize="18px"
                color="var(--c-muted)"
                pointerEvents="none"
              >
                search
              </Box>
              <Input
                placeholder="Search by ID, Nickname, or Faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                h="40px"
                pl="38px"
                borderRadius="xl"
                border="1.5px solid var(--c-outline)"
                bg="var(--c-white)"
                fontSize="xs"
                _focus={{
                  borderColor: "accent.solid",
                  boxShadow: "0 0 0 2px var(--c-chocolate-light)",
                }}
              />
            </Box>
          </HStack>
          <Text
            fontSize="xs"
            color="fg.muted"
            whiteSpace="nowrap"
            fontWeight="600"
          >
            {sortedAndFilteredUsers.length} results
          </Text>
        </Flex>

        {/* Whitelisted Users Table */}
        <Box overflowX="auto" maxH="350px" overflowY="auto">
          <Table.Root size="sm" variant="line">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader width="40px" textAlign="center" fontFamily="heading">
                  <label
                    htmlFor="select-all-checkbox"
                    className="checkbox-label-wrapper"
                  >
                    <input
                      id="select-all-checkbox"
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="anon-checkbox"
                      aria-label="Select all students on page"
                      title="Select all students on page"
                    />
                  </label>
                </Table.ColumnHeader>
                {renderSortableHeader("id", "Student ID")}
                {renderSortableHeader("name", "Nickname")}
                {renderSortableHeader("faculty", "Faculty")}
                {whitelistRoleTab === "staff" && (
                  renderSortableHeader("house", "House Position")
                )}
                {whitelistRoleTab === "staff" && (
                  renderSortableHeader("role", "Role", "1%")
                )}
                {renderSortableHeader("status", "Status")}
                <Table.ColumnHeader textAlign="right" fontFamily="heading">
                  Actions
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sortedAndFilteredUsers.map((u) => (
                <Table.Row
                  key={u.student_id}
                  bg={
                    lastUpdatedStudentId === u.student_id
                      ? "rgba(235, 126, 61, 0.25)"
                      : "transparent"
                  }
                  transition="background-color 0.8s ease-out"
                >
                  <Table.Cell textAlign="center" py={3}>
                    <label
                      htmlFor={`select-user-${u.student_id}`}
                      className="checkbox-label-wrapper"
                    >
                      <input
                        id={`select-user-${u.student_id}`}
                        type="checkbox"
                        checked={selectedStudentIds.includes(
                          u.student_id,
                        )}
                        onChange={(e) =>
                          handleSelectUser(u.student_id, e.target.checked)
                        }
                        className="anon-checkbox"
                        aria-label={`Select student ID ${u.student_id}`}
                        title={`Select student ID ${u.student_id}`}
                      />
                    </label>
                  </Table.Cell>
                  <Table.Cell fontWeight="600">{u.student_id}</Table.Cell>
                  <Table.Cell>
                    {u.nickname || (
                      <Text
                        as="span"
                        color="fg.subtle"
                        fontStyle="italic"
                      >
                        Pending Onboarding
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>{u.faculty || "-"}</Table.Cell>
                  {whitelistRoleTab === "staff" && (
                    <Table.Cell>{u.house_position || "-"}</Table.Cell>
                  )}
                  {whitelistRoleTab === "staff" && (
                    <Table.Cell whiteSpace="nowrap" w="1%">
                      <Badge
                        colorPalette={u.role === "superadmin" ? "red" : u.role === "moderator" ? "amber" : "gray"}
                        variant="subtle"
                        size="sm"
                      >
                        {u.role.toUpperCase()}
                      </Badge>
                    </Table.Cell>
                  )}
                  <Table.Cell>
                    {u.nickname ? (
                      <Tooltip label={`Registered: ${new Date(u.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}>
                        <Badge
                          colorPalette="green"
                          cursor="help"
                          title={`Registered: ${new Date(u.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                        >
                          Registered
                        </Badge>
                      </Tooltip>
                    ) : (
                      <Badge
                        colorPalette="yellow"
                        title="Whitelisted (Pending Registration)"
                      >
                        Whitelisted
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell textAlign="right">
                    <HStack gap={2} justify="end">
                      <Button
                        size="sm"
                        h="40px"
                        py={1.5}
                        px={4}
                        variant="outline"
                        onClick={() => handleInspectUser(u)}
                        cursor="pointer"
                        aria-label={`Inspect details for student ID ${u.student_id}`}
                        title={`Inspect details for student ID ${u.student_id}`}
                      >
                        Inspect
                      </Button>
                      <Button
                        size="sm"
                        h="40px"
                        py={1.5}
                        px={4}
                        variant="ghost"
                        colorPalette="red"
                        onClick={() => setUserToDelete(u.student_id)}
                        cursor="pointer"
                        aria-label={`Remove student ID ${u.student_id} from whitelist`}
                        title={`Remove student ID ${u.student_id} from whitelist`}
                      >
                        Remove
                      </Button>
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      </Box>
    </Box>
  );
}
