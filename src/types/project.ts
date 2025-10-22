export interface Project {
  id: string;
  name: string;
  description?: string;
  project_type: string;
  total_budget: number;
  total_hours: number;
  status: 'in_attesa' | 'approvato' | 'rifiutato';
  created_at: string;
  updated_at: string;
  user_id?: string;
  client_id?: string;
  account_user_id?: string;
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