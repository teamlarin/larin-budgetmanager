// Calcolo del margine residuo per un singolo progetto.
// Sorgente unica: stessa regola di src/lib/marginCalculation.ts e
// supabase/functions/calculate-project-margins/index.ts:
//   (budget attività - costo lavoro - costi esterni) / budget attività * 100
// Se il budget attività è 0 e ci sono costi -> -100. Altrimenti null (non calcolabile).

const PAGE_SIZE = 1000;

function calculateHours(startStr: string, endStr: string): number {
  const start = new Date(startStr);
  const end = new Date(endStr);
  let diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
  return Math.min(diffMs / (1000 * 60 * 60), 16);
}

export async function getProjectResidualMargin(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  projectId: string,
): Promise<number | null> {
  try {
    const [{ data: project }, { data: overheadSetting }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, manual_activities_budget")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "overheads")
        .maybeSingle(),
    ]);

    if (!project) return null;

    const overheadsAmount =
      (overheadSetting?.setting_value as { amount?: number } | null)?.amount || 0;

    // Attività del progetto (tutte le pagine)
    const budgetItems: { id: string; is_product: boolean | null; total_cost: number | null }[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("budget_items")
        .select("id, is_product, total_cost")
        .eq("project_id", projectId)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      budgetItems.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }

    const activitiesBudget = project.manual_activities_budget != null
      ? Number(project.manual_activities_budget)
      : budgetItems
        .filter((bi) => !bi.is_product)
        .reduce((sum, bi) => sum + (bi.total_cost || 0), 0);

    // Registrazioni di tempo (batch sugli ID attività + paginazione)
    const itemIds = budgetItems.map((bi) => bi.id);
    const entries: { user_id: string; actual_start_time: string; actual_end_time: string }[] = [];
    for (let i = 0; i < itemIds.length; i += 100) {
      const idsBatch = itemIds.slice(i, i + 100);
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("activity_time_tracking")
          .select("user_id, actual_start_time, actual_end_time")
          .in("budget_item_id", idsBatch)
          .not("actual_start_time", "is", null)
          .not("actual_end_time", "is", null)
          .order("id", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        entries.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
      }
    }

    const userIds = [...new Set(entries.map((e) => e.user_id))];
    let profileRates = new Map<string, number>();
    let contractPeriods: {
      user_id: string;
      start_date: string;
      end_date: string | null;
      hourly_rate: number | null;
    }[] = [];

    if (userIds.length > 0) {
      const [profilesResult, periodsResult] = await Promise.all([
        supabase.from("profiles").select("id, hourly_rate").in("id", userIds),
        supabase
          .from("user_contract_periods")
          .select("user_id, start_date, end_date, hourly_rate")
          .in("user_id", userIds)
          .order("start_date", { ascending: false }),
      ]);
      profileRates = new Map(
        (profilesResult.data || []).map((p: { id: string; hourly_rate: number | null }) => [
          p.id,
          p.hourly_rate || 0,
        ]),
      );
      contractPeriods = periodsResult.data || [];
    }

    const rateAt = (userId: string, dateStr: string): number => {
      const day = dateStr.slice(0, 10);
      const period = contractPeriods.find((cp) =>
        cp.user_id === userId &&
        cp.start_date <= day &&
        (!cp.end_date || cp.end_date >= day)
      );
      return period?.hourly_rate || profileRates.get(userId) || 0;
    };

    const laborCost = entries.reduce((sum, e) => {
      const hours = calculateHours(e.actual_start_time, e.actual_end_time);
      return sum + hours * (rateAt(e.user_id, e.actual_start_time) + overheadsAmount);
    }, 0);

    const { data: additionalCosts } = await supabase
      .from("project_additional_costs")
      .select("amount")
      .eq("project_id", projectId);

    const externalCost = (additionalCosts || []).reduce(
      (sum: number, ac: { amount: number | null }) => sum + (ac.amount || 0),
      0,
    );

    const totalCost = laborCost + externalCost;

    if (activitiesBudget > 0) {
      return Math.round(((activitiesBudget - totalCost) / activitiesBudget) * 10000) / 100;
    }
    if (totalCost > 0) return -100;
    return null;
  } catch (error) {
    console.error("getProjectResidualMargin error:", error);
    return null;
  }
}
