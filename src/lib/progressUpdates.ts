import { supabase } from '@/integrations/supabase/client';

export interface PublishProgressUpdateInput {
  projectId: string;
  projectName: string;
  progress: number;
  updateText?: string | null;
  roadblocksText?: string | null;
  clientName?: string | null;
  projectLeaderId?: string | null;
  accountUserId?: string | null;
  projectBillingType?: string | null;
}

export interface PublishProgressUpdateResult {
  progressUpdateId: string;
  newProgress: number;
}

const AUTO_PROGRESS_TYPES = ['recurring', 'pack', 'interno', 'consumptive'];

/**
 * Salva un progress update nella tabella project_progress_updates,
 * aggiorna il progress del progetto (se applicabile) e invia la notifica Slack.
 * Ritorna l'id dell'update creato.
 */
export async function publishProgressUpdate(
  input: PublishProgressUpdateInput,
): Promise<PublishProgressUpdateResult> {
  const newProgress = Math.max(0, Math.min(100, Math.round(input.progress)));
  const isAutoProgress = !!input.projectBillingType
    && AUTO_PROGRESS_TYPES.includes(input.projectBillingType);

  // Update project progress (skip for auto-calculated billing types)
  if (!isAutoProgress) {
    const { error: projectError } = await supabase
      .from('projects')
      .update({ progress: newProgress })
      .eq('id', input.projectId);
    if (projectError) throw projectError;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utente non autenticato');

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();
  const userName = profile?.first_name
    ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
    : undefined;

  const { data: inserted, error: updateError } = await supabase
    .from('project_progress_updates')
    .insert({
      project_id: input.projectId,
      user_id: user.id,
      progress_value: newProgress,
      update_text: input.updateText?.trim() || null,
      roadblocks_text: input.roadblocksText?.trim() || null,
    })
    .select('id')
    .single();
  if (updateError) throw updateError;

  // Resolve leader and account names for Slack
  let projectLeaderName: string | undefined;
  let accountName: string | undefined;
  if (input.projectLeaderId) {
    const { data: leaderProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', input.projectLeaderId)
      .maybeSingle();
    if (leaderProfile?.first_name) {
      projectLeaderName = `${leaderProfile.first_name}${leaderProfile.last_name ? ' ' + leaderProfile.last_name : ''}`;
    }
  }
  if (input.accountUserId) {
    const { data: accountProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', input.accountUserId)
      .maybeSingle();
    if (accountProfile?.first_name) {
      accountName = `${accountProfile.first_name}${accountProfile.last_name ? ' ' + accountProfile.last_name : ''}`;
    }
  }

  supabase.functions.invoke('send-slack-notification', {
    body: {
      project_name: input.projectName,
      progress: newProgress,
      update_text: input.updateText?.trim() || undefined,
      roadblocks_text: input.roadblocksText?.trim() || undefined,
      user_name: userName,
      client_name: input.clientName || undefined,
      project_leader_name: projectLeaderName,
      account_name: accountName,
    },
  }).then(({ error }) => {
    if (error) console.error('Slack notification error:', error);
  });

  return { progressUpdateId: inserted.id, newProgress };
}
