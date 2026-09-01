import { supabase } from '@/integrations/supabase/client';

export interface CreateProjectFromOfferResult {
  projectId: string | null;
  created: boolean;
  driveFolderCreated: boolean;
  reason?: 'no_budget' | 'already_linked';
}

/**
 * Automazione all'accettazione di un'offerta con origine "budget":
 * crea il progetto dal budget sorgente, copia le attività (budget_items)
 * e genera la cartella Drive dentro quella del cliente.
 *
 * Idempotente: se l'offerta o il budget hanno già un progetto collegato
 * non crea nulla e restituisce `created: false`.
 */
export const createProjectFromOffer = async (
  offerId: string,
): Promise<CreateProjectFromOfferResult> => {
  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .select('id, year, number, project_id, budget_id, client_id, legacy_quote_number')
    .eq('id', offerId)
    .single();

  if (offerError) throw offerError;

  // Numero preventivo/offerta da riportare sul progetto
  const quoteNumber = offer.legacy_quote_number || `${offer.number}/${offer.year}`;

  if (offer.project_id) {
    // Progetto già esistente: allineo solo lo stato.
    await supabase
      .from('projects')
      .update({
        status: 'approvato',
        project_status: 'in_partenza',
        status_changed_at: new Date().toISOString(),
        manual_quote_number: quoteNumber,
      })
      .eq('id', offer.project_id);

    return { projectId: offer.project_id, created: false, driveFolderCreated: false, reason: 'already_linked' };
  }

  if (!offer.budget_id) {
    return { projectId: null, created: false, driveFolderCreated: false, reason: 'no_budget' };
  }


  const { data: budgetData, error: budgetError } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', offer.budget_id)
    .single();

  if (budgetError) throw budgetError;

  // Il budget potrebbe essere già stato convertito in progetto in passato.
  if (budgetData.project_id) {
    await supabase.from('offers').update({ project_id: budgetData.project_id }).eq('id', offerId);
    return { projectId: budgetData.project_id, created: false, driveFolderCreated: false, reason: 'already_linked' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utente non autenticato');

  const { data: newProject, error: projectCreateError } = await supabase
    .from('projects')
    .insert({
      name: budgetData.name,
      description: budgetData.description,
      project_type: budgetData.project_type,
      client_id: budgetData.client_id,
      client_contact_id: budgetData.client_contact_id,
      account_user_id: budgetData.account_user_id,
      brief_link: budgetData.brief_link,
      discount_percentage: budgetData.discount_percentage,
      margin_percentage: budgetData.margin_percentage,
      objective: budgetData.objective,
      payment_terms: budgetData.payment_terms,
      area: budgetData.area,
      discipline: budgetData.discipline,
      total_budget: budgetData.total_budget,
      total_hours: budgetData.total_hours,
      budget_template_id: budgetData.budget_template_id,
      drive_folder_id: budgetData.drive_folder_id,
      drive_folder_name: budgetData.drive_folder_name,
      status: 'approvato',
      project_status: 'in_partenza',
      status_changed_at: new Date().toISOString(),
      user_id: user.id,
    })
    .select('id')
    .single();

  if (projectCreateError) throw projectCreateError;
  const projectId = newProject.id;

  // Collega offerta e budget al nuovo progetto
  await supabase.from('offers').update({ project_id: projectId }).eq('id', offerId);
  await supabase
    .from('budgets')
    .update({ project_id: projectId, status: 'approvato' })
    .eq('id', offer.budget_id);

  // Copia le attività del budget nel progetto (due passaggi per i parent)
  const { data: budgetItems, error: itemsFetchError } = await supabase
    .from('budget_items')
    .select('*')
    .eq('budget_id', offer.budget_id);

  if (itemsFetchError) {
    console.error('Error fetching budget items:', itemsFetchError);
  }

  if (budgetItems && budgetItems.length > 0) {
    const idMapping: Record<string, string> = {};
    const itemsWithoutParent = budgetItems.filter((item) => !item.parent_id);
    const itemsWithParent = budgetItems.filter((item) => item.parent_id);

    for (const item of itemsWithoutParent) {
      const { id, created_at, updated_at, budget_id: _budgetId, ...itemData } = item;
      const { data: newItem, error: insertError } = await supabase
        .from('budget_items')
        .insert({ ...itemData, project_id: projectId, budget_id: null, created_from: 'budget' })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error inserting budget item:', insertError);
      } else if (newItem) {
        idMapping[id] = newItem.id;
      }
    }

    for (const item of itemsWithParent) {
      const { id: _id, created_at, updated_at, budget_id: _budgetId, parent_id, ...itemData } = item;
      const { error: insertError } = await supabase.from('budget_items').insert({
        ...itemData,
        project_id: projectId,
        budget_id: null,
        parent_id: parent_id ? idMapping[parent_id] ?? null : null,
        created_from: 'budget',
      });

      if (insertError) {
        console.error('Error inserting child budget item:', insertError);
      }
    }
  }

  // Cartella Drive dentro quella del cliente: {anno} | {numero offerta} - {nome progetto}
  let driveFolderCreated = false;
  try {
    const clientId = offer.client_id || budgetData.client_id;
    if (clientId) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('drive_folder_id, name')
        .eq('id', clientId)
        .single();

      if (clientData?.drive_folder_id) {
        const folderName = `${offer.year} | ${offer.number} - ${budgetData.name}`;
        const { data: driveResult, error: driveError } = await supabase.functions.invoke(
          'google-drive-folders',
          { body: { action: 'create-folder', folderName, parentFolderId: clientData.drive_folder_id } },
        );

        if (driveError) {
          console.error('Error creating Drive folder:', driveError);
        } else if (driveResult?.id) {
          await supabase
            .from('projects')
            .update({ drive_folder_id: driveResult.id, drive_folder_name: driveResult.name || folderName })
            .eq('id', projectId);
          driveFolderCreated = true;
        }
      }
    }
  } catch (driveErr) {
    console.error('Drive folder creation failed:', driveErr);
  }

  return { projectId, created: true, driveFolderCreated };
};
