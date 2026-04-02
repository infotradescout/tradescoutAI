/**
 * Centralized Color System for TradeScout
 * All colors should come from this file to ensure consistency
 */

// Status Colors - used across the app
export const STATUS_COLORS = {
  // Task/Project Status
  open: 'bg-blue-600 hover:bg-blue-700 text-white',
  assigned: 'bg-purple-600 hover:bg-purple-700 text-white',
  in_progress: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  quoted: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  completed: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  cancelled: 'bg-red-600 hover:bg-red-700 text-white',
  closed: 'bg-gray-600 hover:bg-gray-700 text-white',
  won: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  lost: 'bg-red-600 hover:bg-red-700 text-white',
  paused: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  ended: 'bg-red-600 hover:bg-red-700 text-white',
  resolved: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  new: 'bg-blue-600 hover:bg-blue-700 text-white',
  contacted: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  
  // Simplified Text Colors
  openText: 'text-blue-400',
  assignedText: 'text-purple-400',
  progressText: 'text-yellow-400',
  completedText: 'text-emerald-400',
  cancelledText: 'text-red-400',
  closedText: 'text-gray-400',
} as const;

// Priority Colors
export const PRIORITY_COLORS = {
  high: 'border-red-600 text-red-400',
  medium: 'border-yellow-600 text-yellow-400',
  low: 'border-green-600 text-green-400',
} as const;

// Category Colors
export const CATEGORY_COLORS = {
  account: 'bg-blue-600',
  billing: 'bg-purple-600',
  technical: 'bg-orange-600',
  general: 'bg-gray-600',
  guide: 'bg-blue-600 hover:bg-blue-700',
  reference: 'bg-purple-600 hover:bg-purple-700',
  template: 'bg-emerald-600 hover:bg-emerald-700',
  tip: 'bg-orange-600 hover:bg-orange-700',
  overview: 'bg-gray-600 hover:bg-gray-700',
} as const;

// Level/Skill Colors
export const LEVEL_COLORS = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
} as const;

// Property/Asset Status Colors
export const PROPERTY_COLORS = {
  fully_occupied: 'bg-green-500',
  partially_vacant: 'bg-yellow-500',
  maintenance_required: 'bg-orange-500',
  under_renovation: 'bg-blue-500',
} as const;

// Utility function to get status color class
export function getStatusColorClass(status: string): string {
  const key = status.toLowerCase().replace(/\s+/g, '_') as keyof typeof STATUS_COLORS;
  return STATUS_COLORS[key] || STATUS_COLORS.open;
}

// Utility function to get priority color class
export function getPriorityColorClass(priority: string): string {
  const key = priority.toLowerCase() as keyof typeof PRIORITY_COLORS;
  return PRIORITY_COLORS[key] || PRIORITY_COLORS.low;
}

// Utility function to get category color class
export function getCategoryColorClass(category: string): string {
  const key = category.toLowerCase().replace(/\s+/g, '_') as keyof typeof CATEGORY_COLORS;
  return CATEGORY_COLORS[key] || CATEGORY_COLORS.general;
}

// Utility function to get level color class
export function getLevelColorClass(level: string): string {
  const key = level.toLowerCase() as keyof typeof LEVEL_COLORS;
  return LEVEL_COLORS[key] || LEVEL_COLORS.beginner;
}
