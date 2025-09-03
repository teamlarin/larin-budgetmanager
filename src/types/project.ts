export interface Project {
  id: string;
  name: string;
  description?: string;
  project_type: string;
  total_budget: number;
  total_hours: number;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  project_type: string;
}