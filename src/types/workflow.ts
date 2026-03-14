// Workflow Template Types
export interface WorkflowTaskTemplate {
  id: string;
  title: string;
  order: number;
  dependsOn: string | null; // ID of another task template
  description?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  tasks: WorkflowTaskTemplate[];
  createdAt: string;
  updatedAt: string;
}

// Active Flow Types
export interface ActiveTask {
  id: string; // DB row id
  taskTemplateId: string | null;
  title: string;
  order: number;
  dependsOn: string | null; // points to another ActiveTask.id in the same flow
  isCompleted: boolean;
  completedAt: string | null;
  description?: string;
  assigneeId: string | null;
  assigneeName: string | null; // resolved from profiles
  dueDate: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface ActiveFlow {
  id: string;
  templateId: string | null;
  templateName: string;
  customName: string;
  ownerId: string;
  ownerName: string; // resolved from profiles
  tasks: ActiveTask[];
  createdAt: string;
  completedAt: string | null;
}

// Profile helper
export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export const getProfileDisplayName = (p: UserProfile): string => {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
  return name || p.email || 'Utente';
};
