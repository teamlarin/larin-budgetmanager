// Workflow Template Types
export interface WorkflowTaskTemplate {
  id: string;
  title: string;
  order: number;
  dependsOn: string | null; // ID of another task, null if no dependency
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
  taskTemplateId: string;
  title: string;
  order: number;
  dependsOn: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  description?: string;
}

export interface ActiveFlow {
  id: string;
  templateId: string;
  templateName: string;
  assignedTo: string; // user display name
  assignedToId: string; // user ID
  tasks: ActiveTask[];
  createdAt: string;
  completedAt: string | null;
}
