-- Create user_faces table to map Supabase users to Immich people
CREATE TABLE IF NOT EXISTS public.user_faces (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id VARCHAR NOT NULL REFERENCES public.users(student_id) ON DELETE CASCADE,
  immich_person_id VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint to prevent duplicate claims
ALTER TABLE public.user_faces ADD CONSTRAINT unique_user_person UNIQUE (student_id, immich_person_id);

-- Add index on student_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_faces_student_id ON public.user_faces(student_id);

-- Optional: Add index on immich_person_id if we ever need to reverse-lookup
CREATE INDEX IF NOT EXISTS idx_user_faces_immich_person_id ON public.user_faces(immich_person_id);
