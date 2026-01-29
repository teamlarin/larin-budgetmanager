import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type ActionType = 
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject';

export type EntityType = 
  | 'project'
  | 'budget'
  | 'quote'
  | 'client'
  | 'user'
  | 'activity'
  | 'timesheet'
  | 'settings'
  | 'product'
  | 'service'
  | 'template';

interface LogActionParams {
  actionType: ActionType;
  actionDescription: string;
  entityType?: EntityType;
  entityId?: string;
  metadata?: Json;
}

export const useActionLogger = () => {
  const logAction = useCallback(async ({
    actionType,
    actionDescription,
    entityType,
    entityId,
    metadata = {} as Json
  }: LogActionParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('user_action_logs').insert([{
        user_id: user.id,
        action_type: actionType,
        action_description: actionDescription,
        entity_type: entityType || null,
        entity_id: entityId || null,
        metadata
      }]);
    } catch (error) {
      // Silently fail - logging should not break the app
      console.error('Failed to log action:', error);
    }
  }, []);

  return { logAction };
};

// Standalone function for use outside React components
export const logAction = async ({
  actionType,
  actionDescription,
  entityType,
  entityId,
  metadata = {} as Json
}: LogActionParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('user_action_logs').insert([{
      user_id: user.id,
      action_type: actionType,
      action_description: actionDescription,
      entity_type: entityType || null,
      entity_id: entityId || null,
      metadata
    }]);
  } catch (error) {
    console.error('Failed to log action:', error);
  }
};
