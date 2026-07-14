import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabase";
import { immich } from "../lib/immich";
import { toaster } from "../components/ui/toaster";



export function useFaceClaim() {
  const { user } = useUser();

  const unclaimFace = async (personId: string) => {
    if (!user) return false;
    
    try {
      // Allow user to unclaim their own, or admin to unclaim any
      const query = supabase.from('user_faces').delete().eq('immich_person_id', personId);
      
      if (user.role !== 'staff' && user.role !== 'moderator') {
        query.eq('student_id', user.student_id);
      }
      
      const { error: sbError } = await query;
      if (sbError) throw sbError;

      // Reset Immich name to empty string (anonymous)
      await immich.people.update(personId, { name: '' });
      
      toaster.create({
        title: "Face Removed",
        description: "Successfully unclaimed this face.",
        type: "success",
      });

      return true;
    } catch (err) {
      console.error("Error unclaiming face:", err);
      toaster.create({
        title: "Failed to remove face",
        type: "error",
      });
      return false;
    }
  };

  return { unclaimFace };
}
