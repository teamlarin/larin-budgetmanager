import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { UserProfile } from '@/types/workflow';

export function useApprovedProfiles() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('approved', true)
        .is('deleted_at', null)
        .order('first_name');
      setProfiles((data as UserProfile[]) || []);
    };
    fetch();
  }, []);

  return profiles;
}
