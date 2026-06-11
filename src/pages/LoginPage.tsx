import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Input,
  Text,
  VStack,
  HStack,
  Spinner,
} from '@chakra-ui/react'
import { useUser } from '../context/UserContext'
import { toaster } from '../components/ui/toaster'

export function LoginPage() {
  const navigate = useNavigate()
  const { user, checkStudentId, login, registerPin, loading } = useUser()

  // Authentication Stages
  // 'id' = Stage 1 (ID verification)
  // 'register_pin' = Stage 2 (First-Time PIN Setup)
  // 'enter_pin' = Stage 2 (Standard PIN Login)
  const [authStage, setAuthStage] = useState<'id' | 'register_pin' | 'enter_pin'>('id')

  const [studentId, setStudentId] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showCheckmark, setShowCheckmark] = useState(false)
  const [checkmarkText, setCheckmarkText] = useState('Welcome Back!')

  useEffect(() => {
    // If already logged in and has profile nickname, redirect to homepage
    if (user && !showCheckmark) {
      if (!user.nickname || !user.faculty) {
        navigate('/profile-setup')
      } else {
        navigate('/')
      }
    }
  }, [user, navigate, showCheckmark])

  // Handle Stage 1: ID Verification
  const handleVerifyId = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedId = studentId.trim()
    if (!trimmedId) {
      toaster.create({
        title: 'Student ID required',
        type: 'error',
      })
      return
    }

    setSubmitting(true)
    const result = await checkStudentId(trimmedId)
    setSubmitting(false)

    if (!result.exists) {
      toaster.create({
        title: 'ID Not Whitelisted',
        description: 'Your Student ID is not in our records. Please contact staff.',
        type: 'error',
      })
      return
    }

    if (result.hasPin) {
      setAuthStage('enter_pin')
    } else {
      setAuthStage('register_pin')
    }
  }

  // Handle Stage 2: Register PIN
  const handleRegisterPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length !== 6 || confirmPin.length !== 6) {
      toaster.create({
        title: 'PIN must be 6 digits',
        type: 'error',
      })
      return
    }

    if (pin !== confirmPin) {
      toaster.create({
        title: 'PINs do not match',
        description: 'Please confirm your 6-digit PIN accurately.',
        type: 'error',
      })
      return
    }

    setSubmitting(true)
    const success = await registerPin(studentId.trim(), pin)
    setSubmitting(false)

    if (success) {
      setCheckmarkText('Setup Complete!')
      setShowCheckmark(true)
      setTimeout(() => {
        navigate('/profile-setup')
      }, 1200)
    } else {
      toaster.create({
        title: 'Registration failed',
        description: 'Failed to configure credentials.',
        type: 'error',
      })
    }
  }

  // Keypad Actions for PIN entry
  const handleKeypadPress = (val: string) => {
    if (authStage === 'enter_pin') {
      if (pin.length < 6) {
        const newPin = pin + val
        setPin(newPin)
        if (newPin.length === 6) {
          triggerPinLogin(newPin)
        }
      }
    } else if (authStage === 'register_pin') {
      if (pin.length < 6) {
        setPin(pin + val)
      } else if (confirmPin.length < 6) {
        setConfirmPin(confirmPin + val)
      }
    }
  }

  const handleBackspace = () => {
    if (authStage === 'enter_pin') {
      setPin(pin.slice(0, -1))
    } else if (authStage === 'register_pin') {
      if (confirmPin.length > 0) {
        setConfirmPin(confirmPin.slice(0, -1))
      } else {
        setPin(pin.slice(0, -1))
      }
    }
  }

  const handleClear = () => {
    setPin('')
    setConfirmPin('')
  }

  const triggerPinLogin = async (enteredPin: string) => {
    setSubmitting(true)
    const success = await login(studentId.trim(), enteredPin)
    setSubmitting(false)

    if (success) {
      setCheckmarkText('Welcome to Baan 7!')
      setShowCheckmark(true)
      setTimeout(() => {
        // Successful login: will auto-route via useEffect
      }, 1200)
    } else {
      setPin('') // Reset PIN on error
      toaster.create({
        title: 'Incorrect PIN',
        description: 'The PIN you entered is incorrect. Please try again.',
        type: 'error',
      })
    }
  }

  if (loading) {
    return (
      <Flex minH="80vh" align="center" justify="center">
        <Spinner size="xl" color="var(--c-lagoon)" />
      </Flex>
    )
  }

  return (
    <Box
      minH="90vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      py={{ base: 6, md: 12 }}
      px={4}
      position="relative"
      overflow="hidden"
    >
      {/* Background SVG decorative line */}
      <Box position="absolute" inset={0} pointerEvents="none" zIndex={0} display={{ base: 'none', md: 'block' }}>
        <svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
          <path
            d="M -100,500 C 300,800 700,200 1100,500"
            fill="none"
            stroke="var(--c-lagoon)"
            strokeWidth="2"
            opacity="0.1"
            strokeDasharray="8 8"
          />
        </svg>
      </Box>

      <Container maxW="md" position="relative" zIndex={1}>
        {showCheckmark ? (
          <VStack
            bg="var(--c-white)"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="2xl"
            p={{ base: 6, md: 8 }}
            boxShadow="var(--shadow-lagoon)"
            align="center"
            py={{ base: 12, md: 16 }}
            animation="scale-in 0.4s var(--ease-out-quart)"
            gap={4}
          >
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              w="80px"
              h="80px"
              borderRadius="full"
              bg="var(--c-lagoon)"
              color="white"
              boxShadow="0 4px 12px rgba(73, 98, 104, 0.3)"
            >
              <Box as="span" className="material-symbols-outlined" fontSize="48px" fontWeight="bold">
                check
              </Box>
            </Box>
            <VStack gap={1}>
              <Heading size="lg" color="var(--c-chocolate)" fontFamily="'Playfair Display', serif" textAlign="center">
                {checkmarkText}
              </Heading>
              <Text color="var(--c-muted)" textAlign="center" px={4} fontSize="sm">
                Redirecting you...
              </Text>
            </VStack>
          </VStack>
        ) : (
          <Box
            bg="var(--c-white)"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="2xl"
            p={{ base: 5, md: 8 }}
            boxShadow="var(--shadow-lagoon)"
            animation="scale-in 0.4s var(--ease-out-quart)"
          >
            <VStack align="stretch" gap={4}>
              <VStack align="center" textAlign="center" mb={2}>
                <Heading
                  as="h1"
                  fontSize="2xl"
                  color="var(--c-chocolate)"
                  fontFamily="'Playfair Display', serif"
                  fontWeight="700"
                >
                  {authStage === 'id' && 'Baan 7 Entrance'}
                  {authStage === 'register_pin' && 'Set Your PIN'}
                  {authStage === 'enter_pin' && 'Enter PIN'}
                </Heading>
                <Text color="var(--c-muted)" fontSize="sm">
                  {authStage === 'id' && 'Verify your Student ID to enter the Baan 7 Orientation Portal.'}
                  {authStage === 'register_pin' && 'Configure a personal 6-digit PIN for future access.'}
                  {authStage === 'enter_pin' && `Enter your 6-digit code for ID: ${studentId}`}
                </Text>
              </VStack>

              {/* STAGE 1: Verify Student ID */}
              {authStage === 'id' && (
                <Box as="form" onSubmit={handleVerifyId}>
                  <VStack align="stretch" gap={4}>
                    <VStack align="stretch" gap={1.5}>
                      <Box
                        fontSize="xs"
                        fontWeight="700"
                        color="var(--c-chocolate)"
                        textTransform="uppercase"
                        letterSpacing="0.05em"
                      >
                        <label htmlFor="student-id-input">Student ID / รหัสนิสิต</label>
                      </Box>
                      <Input
                        id="student-id-input"
                        placeholder="e.g. 6688216"
                        type="text"
                        pattern="\d*"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ''))}
                        borderRadius="xl"
                        border="1.5px solid var(--c-outline)"
                        bg="var(--c-ivory)"
                        _focus={{
                          borderColor: 'var(--c-lagoon)',
                          boxShadow: '0 0 0 3px var(--c-lagoon-light)',
                          bg: 'var(--c-white)',
                        }}
                        h="48px"
                        fontSize="md"
                        required
                        autoComplete="off"
                        textAlign="center"
                        letterSpacing="0.2em"
                        fontWeight="700"
                      />
                    </VStack>

                    <Button
                      type="submit"
                      bg="var(--c-lagoon)"
                      color="white"
                      borderRadius="xl"
                      h="50px"
                      fontSize="md"
                      fontWeight="700"
                      boxShadow="0 4px 12px rgba(73, 98, 104, 0.2)"
                      _hover={{
                        bg: '#3c5156',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(73, 98, 104, 0.3)',
                      }}
                      _active={{ transform: 'translateY(0)' }}
                      transition="all 0.2s var(--ease-out-quart)"
                      loading={submitting}
                      w="100%"
                    >
                      Verify ID
                    </Button>
                  </VStack>
                </Box>
              )}

              {/* STAGE 2: Register PIN Form (Two Fields) */}
              {authStage === 'register_pin' && (
                <Box as="form" onSubmit={handleRegisterPinSubmit}>
                  <VStack align="stretch" gap={4}>
                    <VStack align="stretch" gap={3}>
                      {/* PIN dot progress indicators */}
                      <VStack gap={2}>
                        <Text fontSize="xs" fontWeight="700" color="var(--c-chocolate)" textTransform="uppercase">
                          Enter New 6-digit PIN
                        </Text>
                        <HStack gap={3} justify="center" my={1}>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <Box
                              key={i}
                              w="14px"
                              h="14px"
                              borderRadius="full"
                              bg={i < pin.length ? 'var(--c-chocolate)' : 'var(--c-ivory)'}
                              border="2px solid var(--c-outline)"
                              transition="all 0.1s"
                            />
                          ))}
                        </HStack>
                      </VStack>

                      <VStack gap={2}>
                        <Text fontSize="xs" fontWeight="700" color="var(--c-chocolate)" textTransform="uppercase">
                          Confirm PIN
                        </Text>
                        <HStack gap={3} justify="center" my={1}>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <Box
                              key={i}
                              w="14px"
                              h="14px"
                              borderRadius="full"
                              bg={i < confirmPin.length ? 'var(--c-lagoon)' : 'var(--c-ivory)'}
                              border="2px solid var(--c-outline)"
                              transition="all 0.1s"
                            />
                          ))}
                        </HStack>
                      </VStack>
                    </VStack>

                    {/* Interactive Numeric Keypad */}
                    <Box mt={2}>
                      <NumericKeypad
                        onKeyPress={handleKeypadPress}
                        onBackspace={handleBackspace}
                        onClear={handleClear}
                      />
                    </Box>

                    <Button
                      type="submit"
                      bg="var(--c-chocolate)"
                      color="white"
                      borderRadius="xl"
                      h="50px"
                      fontSize="md"
                      fontWeight="700"
                      _hover={{
                        bg: '#62422f',
                        transform: 'translateY(-2px)',
                      }}
                      loading={submitting}
                      disabled={pin.length !== 6 || confirmPin.length !== 6}
                      w="100%"
                    >
                      Configure PIN
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      color="var(--c-muted)"
                      size="sm"
                      onClick={() => {
                        handleClear()
                        setAuthStage('id')
                      }}
                      _hover={{ bg: 'rgba(0,0,0,0.02)' }}
                    >
                      Back
                    </Button>
                  </VStack>
                </Box>
              )}

              {/* STAGE 2: Standard PIN Login Screen */}
              {authStage === 'enter_pin' && (
                <VStack align="stretch" gap={4}>
                  <VStack gap={3} justify="center">
                    <HStack gap={4} justify="center" my={2}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Box
                          key={i}
                          w="18px"
                          h="18px"
                          borderRadius="full"
                          bg={i < pin.length ? 'var(--c-lagoon)' : 'var(--c-ivory)'}
                          border="2.5px solid var(--c-outline)"
                          transition="all 0.15s var(--ease-out-quart)"
                          transform={i === pin.length ? 'scale(1.15)' : 'scale(1)'}
                        />
                      ))}
                    </HStack>
                  </VStack>

                  {/* Interactive Numeric Keypad */}
                  <NumericKeypad
                    onKeyPress={handleKeypadPress}
                    onBackspace={handleBackspace}
                    onClear={handleClear}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    color="var(--c-muted)"
                    size="sm"
                    onClick={() => {
                      handleClear()
                      setAuthStage('id')
                    }}
                    _hover={{ bg: 'rgba(0,0,0,0.02)' }}
                    minH="44px"
                  >
                    Back to Student ID Verification
                  </Button>
                </VStack>
              )}
            </VStack>
          </Box>
        )}
      </Container>
    </Box>
  )
}

interface KeypadProps {
  onKeyPress: (val: string) => void
  onBackspace: () => void
  onClear: () => void
}

function NumericKeypad({ onKeyPress, onBackspace, onClear }: KeypadProps) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <VStack gap={3} w="100%" maxW="320px" mx="auto" py={3}>
      <Flex gap={3} justify="center" w="100%">
        {keys.slice(0, 3).map((k) => (
          <KeypadButton key={k} value={k} onClick={onKeyPress} />
        ))}
      </Flex>
      <Flex gap={3} justify="center" w="100%">
        {keys.slice(3, 6).map((k) => (
          <KeypadButton key={k} value={k} onClick={onKeyPress} />
        ))}
      </Flex>
      <Flex gap={3} justify="center" w="100%">
        {keys.slice(6, 9).map((k) => (
          <KeypadButton key={k} value={k} onClick={onKeyPress} />
        ))}
      </Flex>
      <Flex gap={3} justify="center" w="100%">
        <Button
          type="button"
          flex={1}
          h="56px"
          borderRadius="xl"
          bg="transparent"
          border="1px solid var(--c-outline)"
          color="var(--c-muted)"
          fontWeight="600"
          fontSize="sm"
          onClick={onClear}
          _hover={{ bg: 'rgba(0,0,0,0.04)' }}
          cursor="pointer"
        >
          Clear
        </Button>
        <KeypadButton value="0" onClick={onKeyPress} />
        <Button
          type="button"
          flex={1}
          h="56px"
          borderRadius="xl"
          bg="transparent"
          border="1px solid var(--c-outline)"
          color="var(--c-muted)"
          onClick={onBackspace}
          _hover={{ bg: 'rgba(0,0,0,0.04)' }}
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          aria-label="Backspace"
        >
          <span className="material-symbols-outlined">backspace</span>
        </Button>
      </Flex>
    </VStack>
  )
}

function KeypadButton({ value, onClick }: { value: string; onClick: (val: string) => void }) {
  return (
    <Button
      type="button"
      flex={1}
      h="56px"
      borderRadius="xl"
      bg="var(--c-ivory)"
      border="1px solid var(--c-outline)"
      color="var(--c-chocolate)"
      fontWeight="700"
      fontSize="lg"
      _hover={{
        bg: 'var(--c-white)',
        borderColor: 'var(--c-lagoon)',
        boxShadow: 'var(--shadow-card-hover)',
      }}
      _active={{
        bg: 'var(--c-lagoon-light)',
      }}
      onClick={() => onClick(value)}
      cursor="pointer"
    >
      {value}
    </Button>
  )
}
