-- Enable RLS on user_faces
ALTER TABLE public.user_faces ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own faces
CREATE POLICY "Users can insert own faces" 
ON public.user_faces 
FOR INSERT 
TO authenticated 
WITH CHECK (student_id = (SELECT student_id FROM public.users WHERE student_id = user_faces.student_id));

-- Allow users to delete their own faces
CREATE POLICY "Users can delete own faces" 
ON public.user_faces 
FOR DELETE 
TO authenticated 
USING (student_id = (SELECT student_id FROM public.users WHERE student_id = user_faces.student_id));

-- Allow staff/moderators to do anything
CREATE POLICY "Staff can manage all faces" 
ON public.user_faces 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.student_id = (SELECT student_id FROM public.users LIMIT 1) 
    AND users.role IN ('staff', 'moderator')
  )
);

-- Allow anyone to read user_faces
CREATE POLICY "Anyone can read user_faces" 
ON public.user_faces 
FOR SELECT 
TO anon, authenticated 
USING (true);
