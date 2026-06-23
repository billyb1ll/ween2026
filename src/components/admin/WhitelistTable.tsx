import React, { useRef } from "react";
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
  handleInlineRoleChange: (id: string, newRole: string, oldRole: string) => void;
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
  handleInlineRoleChange,
  handleInspectUser,
  setUserToDelete,
  handleAddWhitelist,
  handleCSVUpload,
  getRoleDescription,
}: WhitelistTableProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            color="var(--c-chocolate)"
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
              bg="var(--c-chocolate)"
              color="white"
              h="44px"
              py={2}
              px={6}
              borderRadius="xl"
              cursor="pointer"
              _hover={{
                bg: "color-mix(in srgb, var(--c-chocolate) 85%, black)",
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
          align="end"
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
              maxW="200px"
              required
            />
          </VStack>
          <VStack align="start" gap={1}>
            <Box
              fontSize="xs"
              fontWeight="700"
              color="var(--c-muted)"
              textTransform="uppercase"
            >
              <label htmlFor="add-user-role">Role Assignment</label>
            </Box>
            <Tooltip label={getRoleDescription(newRole)}>
              <SearchableSelect
                value={newRole}
                onChange={(val) => setNewRole(val)}
                options={[
                  { value: "student", primaryText: "Student (Freshman)", badge: "STUDENT" },
                  { value: "staff", primaryText: "Staff (Orientation Staff)", badge: "STAFF" },
                  { value: "media_admin", primaryText: "Media Admin (AV Control)", badge: "MEDIA" },
                  { value: "moderator", primaryText: "Moderator", badge: "MOD" },
                ]}
                placeholder="Select Role..."
                searchPlaceholder="พิมพ์ค้นหาบทบาท / Type to search..."
              />
            </Tooltip>
          </VStack>
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
        </Flex>

        {/* Whitelist tab filters */}
        <Tabs.Root
          defaultValue="student"
          value={whitelistRoleTab}
          onValueChange={(details) =>
            setWhitelistRoleTab(details.value as "student" | "staff")
          }
          variant="line"
          mb={4}
        >
          <Tabs.List borderColor="border.subtle">
            <Tabs.Trigger
              value="student"
              cursor="pointer"
              fontSize="xs"
              fontWeight="700"
              px={4}
              py={2}
              h={{ base: "40px", md: "auto" }}
            >
              Freshmen Only (
              {
                whitelistedUsers.filter((u) => u.role === "student")
                  .length
              }
              )
            </Tabs.Trigger>
            <Tabs.Trigger
              value="staff"
              cursor="pointer"
              fontSize="xs"
              fontWeight="700"
              px={4}
              py={2}
              h={{ base: "40px", md: "auto" }}
            >
              Staff & Moderators (
              {
                whitelistedUsers.filter((u) => u.role !== "student")
                  .length
              }
              )
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>

        {/* Search / Filter Bar */}
        <Flex align="center" gap={3} mb={4}>
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
              borderRadius="lg"
              border="1.5px solid var(--c-outline)"
              bg="var(--c-white)"
              fontSize="xs"
              _focus={{
                borderColor: "var(--c-chocolate)",
                boxShadow: "0 0 0 2px var(--c-chocolate-light)",
              }}
            />
          </Box>
          <Text
            fontSize="xs"
            color="fg.muted"
            whiteSpace="nowrap"
            fontWeight="600"
          >
            {filteredWhitelistedUsers.length} results
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
                <Table.ColumnHeader fontFamily="heading">Student ID</Table.ColumnHeader>
                <Table.ColumnHeader fontFamily="heading">Nickname</Table.ColumnHeader>
                <Table.ColumnHeader fontFamily="heading">Faculty</Table.ColumnHeader>
                <Table.ColumnHeader fontFamily="heading">Role</Table.ColumnHeader>
                <Table.ColumnHeader fontFamily="heading">Status</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="right" fontFamily="heading">
                  Actions
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredWhitelistedUsers.map((u) => (
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
                  <Table.Cell>
                    <Box minW="140px">
                      <SearchableSelect
                        value={u.role}
                        onChange={(val) =>
                          handleInlineRoleChange(
                            u.student_id,
                            val,
                            u.role,
                          )
                        }
                        options={[
                          { value: "student", primaryText: "Student", badge: "STUDENT" },
                          { value: "staff", primaryText: "Staff", badge: "STAFF" },
                          { value: "media_admin", primaryText: "Media Admin", badge: "MEDIA" },
                          { value: "moderator", primaryText: "Moderator", badge: "MOD" },
                        ]}
                        placeholder="Select role"
                        searchPlaceholder="ค้นหาบทบาท / Search role..."
                        aria-label={`Change role for ${u.student_id}`}
                        title={`Change role for ${u.student_id}`}
                      />
                    </Box>
                  </Table.Cell>
                  <Table.Cell>
                    {u.nickname ? (
                      <Badge colorPalette="green">Registered</Badge>
                    ) : (
                      <Badge colorPalette="yellow">Whitelisted</Badge>
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
