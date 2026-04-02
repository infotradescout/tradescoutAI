// Task categories for the worker marketplace
export interface TaskCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName: string; // Lucide icon name
  skillTags: string[];
}

export const TASK_CATEGORIES: TaskCategory[] = [
  // General Labor & Moving
  {
    id: 'general-labor',
    name: 'General Labor',
    slug: 'general-labor',
    description: 'Physical work, moving, lifting, and basic manual tasks',
    iconName: 'Users',
    skillTags: ['physical-strength', 'reliability', 'teamwork', 'basic-tools']
  },
  {
    id: 'moving-delivery',
    name: 'Moving & Delivery',
    slug: 'moving-delivery',
    description: 'Moving services, furniture delivery, and transportation tasks',
    iconName: 'Truck',
    skillTags: ['driving', 'physical-strength', 'furniture-handling', 'vehicle-access']
  },

  // Maintenance & Repairs
  {
    id: 'basic-repairs',
    name: 'Basic Repairs & Maintenance',
    slug: 'basic-repairs',
    description: 'Simple repairs, maintenance tasks, and handyman work',
    iconName: 'Wrench',
    skillTags: ['basic-tools', 'problem-solving', 'attention-to-detail', 'maintenance']
  },
  {
    id: 'assembly',
    name: 'Furniture Assembly',
    slug: 'assembly',
    description: 'Furniture assembly, IKEA builds, and installation tasks',
    iconName: 'Package',
    skillTags: ['assembly', 'tool-use', 'following-instructions', 'furniture']
  },

  // Cleaning & Organization
  {
    id: 'cleaning',
    name: 'Cleaning Services',
    slug: 'cleaning',
    description: 'House cleaning, deep cleaning, and organizing tasks',
    iconName: 'Sparkles',
    skillTags: ['attention-to-detail', 'cleaning-supplies', 'organization', 'time-management']
  },
  {
    id: 'organization',
    name: 'Organization & Decluttering',
    slug: 'organization',
    description: 'Home organization, decluttering, and space optimization',
    iconName: 'Archive',
    skillTags: ['organization', 'space-planning', 'sorting', 'efficiency']
  },

  // Yard Work & Outdoor
  {
    id: 'yard-work',
    name: 'Yard Work & Landscaping',
    slug: 'yard-work',
    description: 'Lawn care, gardening, and outdoor maintenance tasks',
    iconName: 'TreePine',
    skillTags: ['outdoor-work', 'gardening', 'physical-activity', 'landscaping-tools']
  },
  {
    id: 'seasonal-tasks',
    name: 'Seasonal Tasks',
    slug: 'seasonal-tasks',
    description: 'Snow removal, leaf cleanup, and seasonal preparations',
    iconName: 'Snowflake',
    skillTags: ['seasonal-work', 'weather-resistant', 'outdoor-tools', 'physical-endurance']
  },

  // Home Improvement Support
  {
    id: 'painting-prep',
    name: 'Painting Prep & Support',
    slug: 'painting-prep',
    description: 'Surface preparation, cleanup, and painting assistance',
    iconName: 'PaintBucket',
    skillTags: ['surface-prep', 'attention-to-detail', 'painting-tools', 'cleanup']
  },
  {
    id: 'demolition',
    name: 'Light Demolition',
    slug: 'demolition',
    description: 'Debris removal, light demolition, and cleanup tasks',
    iconName: 'Hammer',
    skillTags: ['demolition-tools', 'safety-conscious', 'physical-strength', 'debris-removal']
  },

  // Administrative & Digital Support
  {
    id: 'admin-support',
    name: 'Administrative Support',
    slug: 'admin-support',
    description: 'Data entry, organizing paperwork, and office tasks',
    iconName: 'FileText',
    skillTags: ['computer-skills', 'organization', 'data-entry', 'communication']
  },
  {
    id: 'tech-support',
    name: 'Basic Tech Support',
    slug: 'tech-support',
    description: 'Device setup, software installation, and basic tech help',
    iconName: 'Smartphone',
    skillTags: ['technology', 'problem-solving', 'patience', 'communication']
  },

  // Personal Services
  {
    id: 'errands',
    name: 'Errands & Shopping',
    slug: 'errands',
    description: 'Grocery shopping, errands, and personal assistance tasks',
    iconName: 'ShoppingBag',
    skillTags: ['driving', 'communication', 'attention-to-detail', 'time-management']
  },
  {
    id: 'pet-care',
    name: 'Pet Care Services',
    slug: 'pet-care',
    description: 'Dog walking, pet sitting, and basic pet care tasks',
    iconName: 'Heart',
    skillTags: ['animal-care', 'responsibility', 'physical-activity', 'communication']
  },

  // Event & Hospitality Support
  {
    id: 'event-support',
    name: 'Event Support',
    slug: 'event-support',
    description: 'Event setup, serving, and hospitality assistance',
    iconName: 'PartyPopper',
    skillTags: ['customer-service', 'teamwork', 'event-experience', 'communication']
  },
  {
    id: 'photography-assistant',
    name: 'Photography Assistant',
    slug: 'photography-assistant',
    description: 'Photography support, equipment handling, and setup assistance',
    iconName: 'Camera',
    skillTags: ['photography-knowledge', 'equipment-handling', 'attention-to-detail', 'communication']
  },

  // Specialized Skills
  {
    id: 'tutoring',
    name: 'Tutoring & Teaching',
    slug: 'tutoring',
    description: 'Academic tutoring, skill teaching, and educational support',
    iconName: 'GraduationCap',
    skillTags: ['subject-expertise', 'communication', 'patience', 'teaching-ability']
  },
  {
    id: 'crafts-arts',
    name: 'Crafts & Arts Support',
    slug: 'crafts-arts',
    description: 'Art project assistance, craft preparation, and creative support',
    iconName: 'Palette',
    skillTags: ['creativity', 'artistic-skills', 'attention-to-detail', 'project-assistance']
  }
];

export const COMMON_SKILLS = [
  // Physical abilities
  'physical-strength',
  'physical-endurance',
  'lifting-capacity',
  'outdoor-work',
  'weather-resistant',

  // Technical skills
  'basic-tools',
  'power-tools',
  'computer-skills',
  'technology',
  'equipment-handling',

  // Personal skills
  'communication',
  'time-management',
  'attention-to-detail',
  'problem-solving',
  'organization',
  'reliability',
  'teamwork',
  'customer-service',
  'patience',
  'responsibility',

  // Specialized skills
  'driving',
  'vehicle-access',
  'cleaning-supplies',
  'gardening',
  'animal-care',
  'photography-knowledge',
  'subject-expertise',
  'teaching-ability',
  'artistic-skills',
  'creativity',

  // Work environment
  'safety-conscious',
  'following-instructions',
  'efficiency',
  'flexibility',
  'punctuality'
];

export function getCategoryBySlug(slug: string): TaskCategory | undefined {
  return TASK_CATEGORIES.find(category => category.slug === slug);
}

export function getCategoryById(id: string): TaskCategory | undefined {
  return TASK_CATEGORIES.find(category => category.id === id);
}

export function getSkillsByCategory(categorySlug: string): string[] {
  const category = getCategoryBySlug(categorySlug);
  return category ? category.skillTags : [];
}