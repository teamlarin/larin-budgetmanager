export interface Project {
  id: string;
  name: string;
  description?: string;
  project_type: string;
  total_budget: number;
  total_hours: number;
  status: 'in_attesa' | 'approvato' | 'rifiutato';
  project_status?: 'in_partenza' | 'aperto' | 'da_fatturare' | 'completato';
  status_changed_at?: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
  client_id?: string;
  client_contact_id?: string;
  account_user_id?: string;
  brief_link?: string | null;
  discount_percentage?: number;
  margin_percentage?: number;
  objective?: string;
  payment_terms?: string;
  progress?: number;
  area?: string;
  discipline?: string;
  start_date?: string;
  end_date?: string;
  is_billable?: boolean;
  billing_type?: string;
  projection_warning_threshold?: number;
  projection_critical_threshold?: number;
  clients?: {
    name: string;
  };
}

export interface CreateProjectData {
  name: string;
  description?: string;
  project_type: string;
  client_id?: string;
}