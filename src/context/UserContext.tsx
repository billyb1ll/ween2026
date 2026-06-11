/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { hashPin } from '../utils/crypto'

export interface User {
  student_id: string
  pin_hash: string | null
  nickname: string | null
  faculty: string | null
  major: string | null
  ig: string | null
  role: 'superadmin' | 'media_admin' | 'staff' | 'student'
  avatar_color: string
  images: string[]
  tags: string[]
  bio: string | null
  profile_pic_url: string | null
  photo_pool: string[]
  created_at: string
}

interface UserContextType {
  user: User | null
  loading: boolean
  checkStudentId: (studentId: string) => Promise<{ exists: boolean; hasPin: boolean; user?: User }>
  login: (studentId: string, pin: string) => Promise<boolean>
  registerPin: (studentId: string, pin: string) => Promise<boolean>
  updateProfile: (profile: {
    nickname: string
    faculty: string
    major?: string
    ig?: string
    avatarColor?: string
    bio?: string
    profilePicUrl?: string
    photoPool?: string[]
  }) => Promise<boolean>
  logout: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let active = true
    const restoreSession = async () => {
      const savedStudentId = localStorage.getItem('baan7_student_id')
      if (savedStudentId) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('student_id', savedStudentId)
            .single()

          if (!active) return

          if (error || !data) {
            console.error('Session restore failed:', error)
            localStorage.removeItem('baan7_student_id')
          } else {
            setUser(data as User)
          }
        } catch (err) {
          console.error('Session restore failed:', err)
          if (active) localStorage.removeItem('baan7_student_id')
        }
      }
      if (active) setLoading(false)
    }

    restoreSession()
    return () => {
      active = false
    }
  }, [])

  const checkStudentId = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        return { exists: false, hasPin: false }
      }

      return {
        exists: true,
        hasPin: !!data.pin_hash,
        user: data as User,
      }
    } catch (err) {
      console.error('Check student ID error:', err)
      return { exists: false, hasPin: false }
    }
  }

  const login = async (studentId: string, pin: string): Promise<boolean> => {
    try {
      const hashedPin = await hashPin(pin)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('student_id', studentId)
        .eq('pin_hash', hashedPin)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        return false
      }

      setUser(data as User)
      localStorage.setItem('baan7_student_id', data.student_id)
      return true
    } catch (err) {
      console.error('Login error:', err)
      return false
    }
  }

  const registerPin = async (studentId: string, pin: string): Promise<boolean> => {
    try {
      const hashedPin = await hashPin(pin)
      const { data, error } = await supabase
        .from('users')
        .update({ pin_hash: hashedPin })
        .eq('student_id', studentId)
        .is('pin_hash', null)
        .select()
        .single()

      if (error) throw error

      if (!data) {
        return false
      }

      setUser(data as User)
      localStorage.setItem('baan7_student_id', data.student_id)
      return true
    } catch (err) {
      console.error('PIN registration error:', err)
      return false
    }
  }

  const updateProfile = async (profile: {
    nickname: string
    faculty: string
    major?: string
    ig?: string
    avatarColor?: string
    bio?: string
    profilePicUrl?: string
    photoPool?: string[]
  }): Promise<boolean> => {
    if (!user) return false

    try {
      const updates: Partial<User> = {
        nickname: profile.nickname,
        faculty: profile.faculty,
        major: profile.major || null,
        ig: profile.ig || null,
        bio: profile.bio || null,
        profile_pic_url: profile.profilePicUrl || null,
        photo_pool: profile.photoPool || [],
      }

      if (profile.avatarColor) {
        updates.avatar_color = profile.avatarColor
      }

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('student_id', user.student_id)
        .select()
        .single()

      if (error) throw error

      if (!data) return false

      setUser(data as User)
      return true
    } catch (err) {
      console.error('Update profile error:', err)
      return false
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('baan7_student_id')
  }

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        checkStudentId,
        login,
        registerPin,
        updateProfile,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
