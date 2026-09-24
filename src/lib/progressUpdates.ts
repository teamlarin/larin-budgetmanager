import { supabase } from '@/integrations/supabase/client';
import {
  ROADBLOCK_TYPE_LABELS,
  daysOpen,
  getHealthMeta,
  type NewRoadblockInput,
  type ProjectUpdateHealth,
} from '@/lib/projectRoadblocks';

export interface PublishProgressUpdateInput {
  projectId: string;
  projectName: string;
  progress: number;
  updateText?: string | null;
  roadblocksText?: string | null;
  healthStatus?: ProjectUpdateHealth;
  newRoadblocks?: NewRoadblockInput[];
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
 * aggiorna il progress del progetto (se applicabile), crea eventuali roadblock
 * e invia la notifica Slack. Ritorna l'id dell'update creato.
 */
export async function publishProgressUpdate(
  input: PublishProgressUpdateInput,
): Promise<PublishProgressUpdateResult> {
  const newProgress = Math.max(0, Math.min(100, Math.round(input.progress)));
  const isAutoProgress = !!input.projectBillingType
    && AUTO_PROGRESS_TYPES.includes(input.projectBillingType);
  const healthStatus: ProjectUpdateHealth = input.healthStatus || 'in_linea';

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
      health_status: healthStatus,
    })
    .select('id')
    .single();
  if (updateError) {
    // RLS rejection → friendlier message
    if ((updateError as any)?.code === '42501' || /row-level security/i.test(updateError.message)) {
      throw new Error('Solo Project Leader, Admin e Team Leader possono pubblicare aggiornamenti di progresso.');
    }
    throw updateError;
  }

  // Create new roadblocks attached to this update
  const roadblocksToCreate = (input.newRoadblocks || []).filter((r) => r.description.trim());
  if (roadblocksToCreate.length > 0) {
    const { error: rbError } = await supabase.from('project_roadblocks').insert(
      roadblocksToCreate.map((r) => ({
        project_id: input.projectId,
        progress_update_id: inserted.id,
        description: r.description.trim(),
        blocker_type: r.blocker_type,
        waiting_on_who: r.waiting_on_who?.trim() || null,
        waiting_on_what: r.waiting_on_what?.trim() || null,
        created_by: user.id,
      })),
    );
    if (rbError) console.error('Errore creazione roadblock:', rbError);
  }

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

  // Open roadblocks (persistent) for the Slack message
  const { data: openRoadblocks } = await supabase
    .from('project_roadblocks')
    .select('description, blocker_type, opened_at, waiting_on_who, waiting_on_what')
    .eq('project_id', input.projectId)
    .is('resolved_at', null)
    .order('opened_at', { ascending: true });

  const roadblockLines = (openRoadblocks || []).map((r) => {
    const type = ROADBLOCK_TYPE_LABELS[r.blocker_type as keyof typeof ROADBLOCK_TYPE_LABELS] || r.blocker_type;
    const days = daysOpen(r.opened_at);
    const waiting = r.waiting_on_who
      ? ` — in attesa di: ${r.waiting_on_who}${r.waiting_on_what ? ` su ${r.waiting_on_what}` : ''}`
      : '';
    return `• [${type}] ${r.description}${waiting} (aperto da ${days} ${days === 1 ? 'giorno' : 'giorni'})`;
  });

  // Residual margin for the Slack message
  let residualMargin: number | undefined;
  try {
    const { data: marginsResponse } = await supabase.functions.invoke('calculate-project-margins', {
      body: { project_ids: [input.projectId] },
    });
    const m = marginsResponse?.margins?.[input.projectId];
    if (m && typeof m.residualMargin === 'number') residualMargin = m.residualMargin;
  } catch (e) {
    console.error('Errore calcolo margine per Slack:', e);
  }

  supabase.functions.invoke('send-slack-notification', {
    body: {
      project_name: input.projectName,
      progress: newProgress,
      update_text: input.updateText?.trim() || undefined,
      roadblocks_text: input.roadblocksText?.trim() || undefined,
      health_status: healthStatus,
      health_label: getHealthMeta(healthStatus).label,
      open_roadblocks: roadblockLines.length > 0 ? roadblockLines : undefined,
      residual_margin: residualMargin,
      client_name: input.clientName || undefined,
      project_leader_name: projectLeaderName,
      account_name: accountName,
    },

  }).then(({ error }) => {
    if (error) console.error('Slack notification error:', error);
  });

  return { progressUpdateId: inserted.id, newProgress };
}
