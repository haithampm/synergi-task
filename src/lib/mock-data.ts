export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'on-hold' | 'completed' | 'at-risk' | 'archived';
  progress: number;
  team: string[];
  startDate: string;
  endDate: string;
  tasksTotal: number;
  tasksCompleted: number;
  priority: 'high' | 'medium' | 'low';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'high' | 'medium' | 'low' | 'urgent';
  assignee: string;
  projectId: string;
  projectName: string;
  dueDate: string;
  tags: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  email: string;
  tasksAssigned: number;
  tasksCompleted: number;
  status: 'online' | 'away' | 'offline';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const projects: Project[] = [
  { id: '1', name: 'Website Redesign', description: 'Complete overhaul of the company website with modern UI/UX', status: 'active', progress: 68, team: ['Alice', 'Bob', 'Carol'], startDate: '2026-01-15', endDate: '2026-05-30', tasksTotal: 42, tasksCompleted: 28, priority: 'high' },
  { id: '2', name: 'Mobile App v2', description: 'Next generation mobile application with AI features', status: 'active', progress: 35, team: ['Dave', 'Eve', 'Frank'], startDate: '2026-02-01', endDate: '2026-07-15', tasksTotal: 56, tasksCompleted: 20, priority: 'high' },
  { id: '3', name: 'Data Pipeline', description: 'Real-time data processing and analytics pipeline', status: 'at-risk', progress: 22, team: ['Grace', 'Hank'], startDate: '2026-03-01', endDate: '2026-06-30', tasksTotal: 30, tasksCompleted: 7, priority: 'medium' },
  { id: '4', name: 'API Gateway', description: 'Centralized API management and security layer', status: 'completed', progress: 100, team: ['Ivy', 'Jack'], startDate: '2025-11-01', endDate: '2026-03-15', tasksTotal: 24, tasksCompleted: 24, priority: 'low' },
  { id: '5', name: 'Customer Portal', description: 'Self-service portal for enterprise customers', status: 'on-hold', progress: 45, team: ['Kate', 'Leo'], startDate: '2026-01-20', endDate: '2026-08-01', tasksTotal: 38, tasksCompleted: 17, priority: 'medium' },
];

export const tasks: Task[] = [
  { id: 't1', title: 'Design new homepage layout', description: 'Create wireframes and mockups for the homepage', status: 'in-progress', priority: 'high', assignee: 'Alice', projectId: '1', projectName: 'Website Redesign', dueDate: '2026-04-15', tags: ['design', 'ui'] },
  { id: 't2', title: 'Implement auth flow', description: 'Set up JWT authentication with OAuth support', status: 'todo', priority: 'urgent', assignee: 'Bob', projectId: '1', projectName: 'Website Redesign', dueDate: '2026-04-10', tags: ['backend', 'security'] },
  { id: 't3', title: 'Setup CI/CD pipeline', description: 'Configure automated testing and deployment', status: 'done', priority: 'medium', assignee: 'Carol', projectId: '1', projectName: 'Website Redesign', dueDate: '2026-04-05', tags: ['devops'] },
  { id: 't4', title: 'API integration testing', description: 'End-to-end testing of all API endpoints', status: 'review', priority: 'high', assignee: 'Dave', projectId: '2', projectName: 'Mobile App v2', dueDate: '2026-04-20', tags: ['testing', 'api'] },
  { id: 't5', title: 'Push notification service', description: 'Implement push notifications for iOS and Android', status: 'backlog', priority: 'medium', assignee: 'Eve', projectId: '2', projectName: 'Mobile App v2', dueDate: '2026-05-01', tags: ['mobile', 'backend'] },
  { id: 't6', title: 'Database schema migration', description: 'Migrate to new schema with partitioning', status: 'in-progress', priority: 'urgent', assignee: 'Grace', projectId: '3', projectName: 'Data Pipeline', dueDate: '2026-04-08', tags: ['database'] },
  { id: 't7', title: 'Write API documentation', description: 'Complete OpenAPI spec documentation', status: 'todo', priority: 'low', assignee: 'Frank', projectId: '2', projectName: 'Mobile App v2', dueDate: '2026-04-25', tags: ['docs'] },
  { id: 't8', title: 'Performance optimization', description: 'Optimize database queries and caching', status: 'in-progress', priority: 'high', assignee: 'Hank', projectId: '3', projectName: 'Data Pipeline', dueDate: '2026-04-12', tags: ['performance'] },
  { id: 't9', title: 'User onboarding flow', description: 'Design and implement user onboarding', status: 'todo', priority: 'medium', assignee: 'Alice', projectId: '1', projectName: 'Website Redesign', dueDate: '2026-04-18', tags: ['ux', 'frontend'] },
  { id: 't10', title: 'Security audit', description: 'Comprehensive security review of all services', status: 'backlog', priority: 'high', assignee: 'Bob', projectId: '1', projectName: 'Website Redesign', dueDate: '2026-05-15', tags: ['security'] },
];

export const teamMembers: TeamMember[] = [
  { id: 'm1', name: 'Alice Chen', role: 'Lead Designer', avatar: 'AC', email: 'alice@company.com', tasksAssigned: 8, tasksCompleted: 5, status: 'online' },
  { id: 'm2', name: 'Bob Smith', role: 'Senior Developer', avatar: 'BS', email: 'bob@company.com', tasksAssigned: 6, tasksCompleted: 3, status: 'online' },
  { id: 'm3', name: 'Carol Davis', role: 'DevOps Engineer', avatar: 'CD', email: 'carol@company.com', tasksAssigned: 4, tasksCompleted: 4, status: 'away' },
  { id: 'm4', name: 'Dave Wilson', role: 'Backend Developer', avatar: 'DW', email: 'dave@company.com', tasksAssigned: 7, tasksCompleted: 2, status: 'online' },
  { id: 'm5', name: 'Eve Martinez', role: 'Mobile Developer', avatar: 'EM', email: 'eve@company.com', tasksAssigned: 5, tasksCompleted: 1, status: 'offline' },
  { id: 'm6', name: 'Frank Lee', role: 'Full Stack Developer', avatar: 'FL', email: 'frank@company.com', tasksAssigned: 3, tasksCompleted: 1, status: 'online' },
  { id: 'm7', name: 'Grace Kim', role: 'Data Engineer', avatar: 'GK', email: 'grace@company.com', tasksAssigned: 5, tasksCompleted: 2, status: 'away' },
  { id: 'm8', name: 'Hank Brown', role: 'Senior Engineer', avatar: 'HB', email: 'hank@company.com', tasksAssigned: 4, tasksCompleted: 3, status: 'online' },
];

export const dashboardStats = {
  totalProjects: 5,
  activeProjects: 2,
  totalTasks: 10,
  completedTasks: 1,
  teamSize: 8,
  overdueTasks: 2,
};

export const chartData = {
  tasksByStatus: [
    { name: 'Backlog', value: 2, fill: 'hsl(var(--muted-foreground))' },
    { name: 'To Do', value: 3, fill: 'hsl(var(--info))' },
    { name: 'In Progress', value: 3, fill: 'hsl(var(--primary))' },
    { name: 'Review', value: 1, fill: 'hsl(var(--warning))' },
    { name: 'Done', value: 1, fill: 'hsl(var(--success))' },
  ],
  weeklyProgress: [
    { day: 'Mon', completed: 4, created: 6 },
    { day: 'Tue', completed: 7, created: 3 },
    { day: 'Wed', completed: 5, created: 8 },
    { day: 'Thu', completed: 9, created: 4 },
    { day: 'Fri', completed: 6, created: 5 },
    { day: 'Sat', completed: 2, created: 1 },
    { day: 'Sun', completed: 1, created: 2 },
  ],
};
