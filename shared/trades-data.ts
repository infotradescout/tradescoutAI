// Comprehensive trades and specialties for contractor marketplace
export interface Trade {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  description: string;
  category: 'construction' | 'home_improvement' | 'maintenance' | 'specialty' | 'exterior' | 'interior';
}

export const COMPREHENSIVE_TRADES: Trade[] = [
  // GENERAL CONSTRUCTION
  {
    id: 'general-contractor',
    name: 'General Contractor',
    slug: 'general-contractor',
    description: 'Complete project management and construction services',
    category: 'construction'
  },
  {
    id: 'custom-home-builder',
    name: 'Custom Home Builder',
    slug: 'custom-home-builder',
    description: 'New home construction and custom building',
    category: 'construction'
  },
  {
    id: 'remodeling-contractor',
    name: 'Remodeling Contractor',
    slug: 'remodeling-contractor',
    description: 'Home renovations and remodeling projects',
    category: 'construction'
  },
  {
    id: 'addition-contractor',
    name: 'Addition Contractor',
    slug: 'addition-contractor',
    description: 'Home additions and expansions',
    category: 'construction'
  },

  // ROOFING & EXTERIOR
  {
    id: 'roofing',
    name: 'Roofing Contractor',
    slug: 'roofing',
    description: 'Roof installation, repair, and maintenance',
    category: 'exterior'
  },
  {
    id: 'roof-repair',
    name: 'Roof Repair Specialist',
    slug: 'roof-repair',
    parentId: 'roofing',
    description: 'Emergency roof repairs and leak fixes',
    category: 'exterior'
  },
  {
    id: 'gutter-contractor',
    name: 'Gutter Installation & Repair',
    slug: 'gutter-contractor',
    description: 'Gutter systems, cleaning, and maintenance',
    category: 'exterior'
  },
  {
    id: 'siding-contractor',
    name: 'Siding Contractor',
    slug: 'siding-contractor',
    description: 'Siding installation, repair, and replacement',
    category: 'exterior'
  },
  {
    id: 'window-contractor',
    name: 'Window Installation & Repair',
    slug: 'window-contractor',
    description: 'Window replacement, installation, and repair services',
    category: 'exterior'
  },
  {
    id: 'door-contractor',
    name: 'Door Installation & Repair',
    slug: 'door-contractor',
    description: 'Entry doors, patio doors, and door hardware',
    category: 'exterior'
  },
  {
    id: 'deck-contractor',
    name: 'Deck Construction & Repair',
    slug: 'deck-contractor',
    description: 'Custom deck building, repair, and maintenance',
    category: 'exterior'
  },
  {
    id: 'fence-contractor',
    name: 'Fence Installation',
    slug: 'fence-contractor',
    description: 'Residential and commercial fencing solutions',
    category: 'exterior'
  },
  {
    id: 'concrete-contractor',
    name: 'Concrete Contractor',
    slug: 'concrete-contractor',
    description: 'Driveways, walkways, patios, and foundations',
    category: 'exterior'
  },
  {
    id: 'masonry-contractor',
    name: 'Masonry & Stonework',
    slug: 'masonry-contractor',
    description: 'Brick, stone, and block construction and repair',
    category: 'exterior'
  },

  // PLUMBING SPECIALISTS
  {
    id: 'plumbing',
    name: 'Plumbing Contractor',
    slug: 'plumbing',
    description: 'Complete plumbing services and emergency repairs',
    category: 'home_improvement'
  },
  {
    id: 'emergency-plumber',
    name: 'Emergency Plumber',
    slug: 'emergency-plumber',
    parentId: 'plumbing',
    description: '24/7 emergency plumbing repairs and service',
    category: 'home_improvement'
  },
  {
    id: 'drain-cleaning',
    name: 'Drain Cleaning Specialist',
    slug: 'drain-cleaning',
    parentId: 'plumbing',
    description: 'Professional drain and sewer cleaning services',
    category: 'home_improvement'
  },
  {
    id: 'water-heater',
    name: 'Water Heater Installation',
    slug: 'water-heater',
    parentId: 'plumbing',
    description: 'Water heater repair, replacement, and maintenance',
    category: 'home_improvement'
  },
  {
    id: 'pipe-repair',
    name: 'Pipe Repair & Replacement',
    slug: 'pipe-repair',
    parentId: 'plumbing',
    description: 'Pipe installation, repair, and repiping services',
    category: 'home_improvement'
  },

  // ELECTRICAL SPECIALISTS
  {
    id: 'electrical',
    name: 'Electrical Contractor',
    slug: 'electrical',
    description: 'Licensed electrical installation and repair services',
    category: 'home_improvement'
  },
  {
    id: 'panel-upgrade',
    name: 'Electrical Panel Upgrade',
    slug: 'panel-upgrade',
    parentId: 'electrical',
    description: 'Electrical panel upgrades and circuit installation',
    category: 'home_improvement'
  },
  {
    id: 'lighting-contractor',
    name: 'Lighting Installation',
    slug: 'lighting-contractor',
    parentId: 'electrical',
    description: 'Interior and exterior lighting design and installation',
    category: 'home_improvement'
  },
  {
    id: 'ceiling-fan-installation',
    name: 'Ceiling Fan Installation',
    slug: 'ceiling-fan-installation',
    parentId: 'electrical',
    description: 'Ceiling fan installation and repair services',
    category: 'home_improvement'
  },
  {
    id: 'electrical-wiring',
    name: 'Electrical Wiring',
    slug: 'electrical-wiring',
    parentId: 'electrical',
    description: 'Home rewiring and electrical outlet installation',
    category: 'home_improvement'
  },

  // HVAC SPECIALISTS
  {
    id: 'hvac',
    name: 'HVAC Contractor',
    slug: 'hvac',
    description: 'Heating, ventilation, and air conditioning services',
    category: 'home_improvement'
  },
  {
    id: 'air-conditioning',
    name: 'Air Conditioning Repair',
    slug: 'air-conditioning',
    parentId: 'hvac',
    description: 'AC installation, repair, and maintenance',
    category: 'home_improvement'
  },
  {
    id: 'heating-contractor',
    name: 'Heating System Installation',
    slug: 'heating-contractor',
    parentId: 'hvac',
    description: 'Furnace and heating system installation and repair',
    category: 'home_improvement'
  },
  {
    id: 'duct-cleaning',
    name: 'Duct Cleaning Services',
    slug: 'duct-cleaning',
    parentId: 'hvac',
    description: 'Air duct cleaning and HVAC maintenance',
    category: 'home_improvement'
  },

  // INTERIOR RENOVATIONS
  {
    id: 'kitchen-remodel',
    name: 'Kitchen Remodeling',
    slug: 'kitchen-remodel',
    description: 'Complete kitchen renovations and upgrades',
    category: 'interior'
  },
  {
    id: 'bathroom-remodel',
    name: 'Bathroom Remodeling',
    slug: 'bathroom-remodel',
    description: 'Bathroom renovations and fixture installation',
    category: 'interior'
  },
  {
    id: 'basement-finishing',
    name: 'Basement Finishing',
    slug: 'basement-finishing',
    description: 'Basement remodeling and finishing services',
    category: 'interior'
  },
  {
    id: 'attic-conversion',
    name: 'Attic Conversion',
    slug: 'attic-conversion',
    description: 'Attic finishing and conversion to living space',
    category: 'interior'
  },

  // FLOORING SPECIALISTS
  {
    id: 'hardwood-flooring',
    name: 'Hardwood Flooring',
    slug: 'hardwood-flooring',
    description: 'Hardwood floor installation, refinishing, and repair',
    category: 'interior'
  },
  {
    id: 'carpet-installation',
    name: 'Carpet Installation',
    slug: 'carpet-installation',
    description: 'Carpet installation and replacement services',
    category: 'interior'
  },
  {
    id: 'tile-contractor',
    name: 'Tile Installation',
    slug: 'tile-contractor',
    description: 'Ceramic, porcelain, and natural stone tile installation',
    category: 'interior'
  },
  {
    id: 'laminate-flooring',
    name: 'Laminate Flooring',
    slug: 'laminate-flooring',
    description: 'Laminate and luxury vinyl plank installation',
    category: 'interior'
  },
  {
    id: 'floor-refinishing',
    name: 'Floor Refinishing',
    slug: 'floor-refinishing',
    description: 'Hardwood floor sanding, staining, and refinishing',
    category: 'interior'
  },

  // PAINTING & FINISHING
  {
    id: 'interior-painting',
    name: 'Interior Painting',
    slug: 'interior-painting',
    description: 'Professional interior painting services',
    category: 'interior'
  },
  {
    id: 'exterior-painting',
    name: 'Exterior Painting',
    slug: 'exterior-painting',
    description: 'Exterior house painting and staining',
    category: 'exterior'
  },
  {
    id: 'cabinet-painting',
    name: 'Cabinet Painting & Refinishing',
    slug: 'cabinet-painting',
    description: 'Kitchen and bathroom cabinet refinishing',
    category: 'interior'
  },
  {
    id: 'drywall-contractor',
    name: 'Drywall Installation & Repair',
    slug: 'drywall-contractor',
    description: 'Drywall installation, repair, and texturing',
    category: 'interior'
  },
  {
    id: 'wallpaper-installation',
    name: 'Wallpaper Installation',
    slug: 'wallpaper-installation',
    description: 'Wallpaper hanging and removal services',
    category: 'interior'
  },

  // LANDSCAPING & OUTDOOR
  {
    id: 'landscaping',
    name: 'Landscaping Contractor',
    slug: 'landscaping',
    description: 'Landscape design, installation, and maintenance',
    category: 'exterior'
  },
  {
    id: 'lawn-care',
    name: 'Lawn Care Services',
    slug: 'lawn-care',
    description: 'Regular lawn maintenance and landscaping services',
    category: 'maintenance'
  },
  {
    id: 'tree-service',
    name: 'Tree Service & Removal',
    slug: 'tree-service',
    description: 'Tree trimming, removal, and arborist services',
    category: 'maintenance'
  },
  {
    id: 'irrigation',
    name: 'Irrigation System Installation',
    slug: 'irrigation',
    description: 'Sprinkler system installation and maintenance',
    category: 'exterior'
  },
  {
    id: 'pool-contractor',
    name: 'Pool Installation & Repair',
    slug: 'pool-contractor',
    description: 'Swimming pool construction, repair, and maintenance',
    category: 'specialty'
  },
  {
    id: 'outdoor-lighting',
    name: 'Outdoor Lighting Installation',
    slug: 'outdoor-lighting',
    description: 'Landscape and security lighting installation',
    category: 'exterior'
  },

  // SPECIALTY SERVICES
  {
    id: 'insulation-contractor',
    name: 'Insulation Installation',
    slug: 'insulation-contractor',
    description: 'Home insulation installation and energy efficiency',
    category: 'specialty'
  },
  {
    id: 'solar-contractor',
    name: 'Solar Panel Installation',
    slug: 'solar-contractor',
    description: 'Solar panel system installation and maintenance',
    category: 'specialty'
  },
  {
    id: 'security-systems',
    name: 'Security System Installation',
    slug: 'security-systems',
    description: 'Home security and surveillance system installation',
    category: 'specialty'
  },
  {
    id: 'smart-home',
    name: 'Smart Home Automation',
    slug: 'smart-home',
    description: 'Smart home technology installation and setup',
    category: 'specialty'
  },
  {
    id: 'garage-door',
    name: 'Garage Door Installation & Repair',
    slug: 'garage-door',
    description: 'Garage door installation, repair, and opener service',
    category: 'specialty'
  },
  {
    id: 'chimney-services',
    name: 'Chimney Services',
    slug: 'chimney-services',
    description: 'Chimney cleaning, repair, and inspection',
    category: 'specialty'
  },
  {
    id: 'pest-control',
    name: 'Pest Control Services',
    slug: 'pest-control',
    description: 'Professional pest control and extermination',
    category: 'maintenance'
  },
  {
    id: 'handyman',
    name: 'Handyman Services',
    slug: 'handyman',
    description: 'General home repairs and maintenance',
    category: 'maintenance'
  },
  {
    id: 'moving-services',
    name: 'Moving Services',
    slug: 'moving-services',
    description: 'Professional moving and relocation services',
    category: 'specialty'
  },
  {
    id: 'cleaning-services',
    name: 'House Cleaning Services',
    slug: 'cleaning-services',
    description: 'Residential cleaning and maid services',
    category: 'maintenance'
  },

  // RESTORATION & EMERGENCY
  {
    id: 'water-damage-restoration',
    name: 'Water Damage Restoration',
    slug: 'water-damage-restoration',
    description: 'Emergency water damage cleanup and restoration',
    category: 'specialty'
  },
  {
    id: 'fire-damage-restoration',
    name: 'Fire Damage Restoration',
    slug: 'fire-damage-restoration',
    description: 'Fire and smoke damage restoration services',
    category: 'specialty'
  },
  {
    id: 'mold-remediation',
    name: 'Mold Remediation',
    slug: 'mold-remediation',
    description: 'Professional mold removal and remediation',
    category: 'specialty'
  },
  {
    id: 'storm-damage-repair',
    name: 'Storm Damage Repair',
    slug: 'storm-damage-repair',
    description: 'Emergency storm and wind damage repairs',
    category: 'specialty'
  }
];

// Export function to get trades by category
export function getTradesByCategory(category?: string): Trade[] {
  if (!category) return COMPREHENSIVE_TRADES;
  return COMPREHENSIVE_TRADES.filter(trade => trade.category === category);
}

// Export function to get parent trades (top-level categories)
export function getParentTrades(): Trade[] {
  return COMPREHENSIVE_TRADES.filter(trade => !trade.parentId);
}

// Export function to get child trades for a parent
export function getChildTrades(parentId: string): Trade[] {
  return COMPREHENSIVE_TRADES.filter(trade => trade.parentId === parentId);
}
    category: 'maintenance'
  },
  {
    id: 'water-heater',
    name: 'Water Heater Services',
    slug: 'water-heater',
    parentId: 'plumbing',
    description: 'Water heater installation, repair, and replacement',
    category: 'maintenance'
  },
  {
    id: 'hvac',
    name: 'HVAC Services',
    slug: 'hvac',
    description: 'Heating, ventilation, and air conditioning services',
    category: 'maintenance'
  },
  {
    id: 'air-conditioning',
    name: 'Air Conditioning',
    slug: 'air-conditioning',
    parentId: 'hvac',
    description: 'AC installation, repair, and maintenance',
    category: 'maintenance'
  },
  {
    id: 'heating-contractor',
    name: 'Heating Systems',
    slug: 'heating-contractor',
    parentId: 'hvac',
    description: 'Furnace and heating system services',
    category: 'maintenance'
  },
  {
    id: 'duct-cleaning',
    name: 'Duct Cleaning',
    slug: 'duct-cleaning',
    parentId: 'hvac',
    description: 'Air duct cleaning and maintenance',
    category: 'maintenance'
  },

  // ELECTRICAL
  {
    id: 'electrical',
    name: 'Electrical Services',
    slug: 'electrical',
    description: 'Electrical installation, repair, and maintenance',
    category: 'maintenance'
  },
  {
    id: 'emergency-electrician',
    name: 'Emergency Electrician',
    slug: 'emergency-electrician',
    parentId: 'electrical',
    description: '24/7 emergency electrical services',
    category: 'maintenance'
  },
  {
    id: 'panel-upgrade',
    name: 'Electrical Panel Upgrade',
    slug: 'panel-upgrade',
    parentId: 'electrical',
    description: 'Electrical panel upgrades and replacements',
    category: 'maintenance'
  },
  {
    id: 'ceiling-fan-installation',
    name: 'Ceiling Fan Installation',
    slug: 'ceiling-fan-installation',
    parentId: 'electrical',
    description: 'Ceiling fan installation and repair',
    category: 'maintenance'
  },
  {
    id: 'lighting-contractor',
    name: 'Lighting Installation',
    slug: 'lighting-contractor',
    parentId: 'electrical',
    description: 'Interior and exterior lighting installation',
    category: 'maintenance'
  },

  // INTERIOR RENOVATIONS
  {
    id: 'kitchen-remodel',
    name: 'Kitchen Remodeling',
    slug: 'kitchen-remodel',
    description: 'Complete kitchen renovations and remodeling',
    category: 'interior'
  },
  {
    id: 'bathroom-remodel',
    name: 'Bathroom Remodeling',
    slug: 'bathroom-remodel',
    description: 'Bathroom renovations and remodeling',
    category: 'interior'
  },
  {
    id: 'basement-finishing',
    name: 'Basement Finishing',
    slug: 'basement-finishing',
    description: 'Basement finishing and waterproofing',
    category: 'interior'
  },
  {
    id: 'attic-conversion',
    name: 'Attic Conversion',
    slug: 'attic-conversion',
    description: 'Attic finishing and conversion services',
    category: 'interior'
  },

  // FLOORING
  {
    id: 'flooring',
    name: 'Flooring Contractor',
    slug: 'flooring',
    description: 'Flooring installation, refinishing, and repair',
    category: 'interior'
  },
  {
    id: 'hardwood-flooring',
    name: 'Hardwood Flooring',
    slug: 'hardwood-flooring',
    parentId: 'flooring',
    description: 'Hardwood floor installation and refinishing',
    category: 'interior'
  },
  {
    id: 'carpet-installation',
    name: 'Carpet Installation',
    slug: 'carpet-installation',
    parentId: 'flooring',
    description: 'Carpet installation and repair services',
    category: 'interior'
  },
  {
    id: 'tile-contractor',
    name: 'Tile Installation',
    slug: 'tile-contractor',
    parentId: 'flooring',
    description: 'Tile and stone installation services',
    category: 'interior'
  },
  {
    id: 'laminate-flooring',
    name: 'Laminate Flooring',
    slug: 'laminate-flooring',
    parentId: 'flooring',
    description: 'Laminate and vinyl flooring installation',
    category: 'interior'
  },

  // PAINTING & FINISHING
  {
    id: 'painting',
    name: 'Painting Services',
    slug: 'painting',
    description: 'Interior and exterior painting services',
    category: 'interior'
  },
  {
    id: 'interior-painting',
    name: 'Interior Painting',
    slug: 'interior-painting',
    parentId: 'painting',
    description: 'Interior house painting and finishing',
    category: 'interior'
  },
  {
    id: 'exterior-painting',
    name: 'Exterior Painting',
    slug: 'exterior-painting',
    parentId: 'painting',
    description: 'Exterior house painting and staining',
    category: 'exterior'
  },
  {
    id: 'cabinet-painting',
    name: 'Cabinet Painting & Refinishing',
    slug: 'cabinet-painting',
    parentId: 'painting',
    description: 'Kitchen cabinet painting and refinishing',
    category: 'interior'
  },
  {
    id: 'drywall-contractor',
    name: 'Drywall Installation & Repair',
    slug: 'drywall-contractor',
    description: 'Drywall installation, repair, and finishing',
    category: 'interior'
  },

  // LANDSCAPING & OUTDOOR
  {
    id: 'landscaping',
    name: 'Landscaping Services',
    slug: 'landscaping',
    description: 'Landscape design, installation, and maintenance',
    category: 'exterior'
  },
  {
    id: 'lawn-care',
    name: 'Lawn Care & Maintenance',
    slug: 'lawn-care',
    parentId: 'landscaping',
    description: 'Lawn mowing, fertilizing, and maintenance',
    category: 'exterior'
  },
  {
    id: 'tree-service',
    name: 'Tree Services',
    slug: 'tree-service',
    description: 'Tree removal, trimming, and stump grinding',
    category: 'exterior'
  },
  {
    id: 'irrigation',
    name: 'Irrigation & Sprinkler Systems',
    slug: 'irrigation',
    parentId: 'landscaping',
    description: 'Sprinkler system installation and repair',
    category: 'exterior'
  },
  {
    id: 'pool-contractor',
    name: 'Pool Installation & Repair',
    slug: 'pool-contractor',
    description: 'Swimming pool construction and maintenance',
    category: 'exterior'
  },

  // SPECIALTY SERVICES
  {
    id: 'insulation-contractor',
    name: 'Insulation Services',
    slug: 'insulation-contractor',
    description: 'Insulation installation and energy efficiency',
    category: 'specialty'
  },
  {
    id: 'solar-contractor',
    name: 'Solar Installation',
    slug: 'solar-contractor',
    description: 'Solar panel installation and maintenance',
    category: 'specialty'
  },
  {
    id: 'security-systems',
    name: 'Security System Installation',
    slug: 'security-systems',
    description: 'Home security and surveillance systems',
    category: 'specialty'
  },
  {
    id: 'smart-home',
    name: 'Smart Home Automation',
    slug: 'smart-home',
    description: 'Smart home technology and automation',
    category: 'specialty'
  },
  {
    id: 'home-theater',
    name: 'Home Theater Installation',
    slug: 'home-theater',
    description: 'Home theater and audio/video systems',
    category: 'specialty'
  },
  {
    id: 'garage-door',
    name: 'Garage Door Services',
    slug: 'garage-door',
    description: 'Garage door installation, repair, and maintenance',
    category: 'maintenance'
  },
  {
    id: 'chimney-services',
    name: 'Chimney Services',
    slug: 'chimney-services',
    description: 'Chimney cleaning, repair, and maintenance',
    category: 'maintenance'
  },
  {
    id: 'pest-control',
    name: 'Pest Control',
    slug: 'pest-control',
    description: 'Pest control and extermination services',
    category: 'maintenance'
  },
  {
    id: 'mold-remediation',
    name: 'Mold Remediation',
    slug: 'mold-remediation',
    description: 'Mold removal and remediation services',
    category: 'specialty'
  },
  {
    id: 'waterproofing',
    name: 'Waterproofing Services',
    slug: 'waterproofing',
    description: 'Basement and foundation waterproofing',
    category: 'specialty'
  },

  // CLEANING & MAINTENANCE
  {
    id: 'house-cleaning',
    name: 'House Cleaning',
    slug: 'house-cleaning',
    description: 'Residential cleaning services',
    category: 'maintenance'
  },
  {
    id: 'carpet-cleaning',
    name: 'Carpet & Upholstery Cleaning',
    slug: 'carpet-cleaning',
    description: 'Professional carpet and upholstery cleaning',
    category: 'maintenance'
  },
  {
    id: 'window-cleaning',
    name: 'Window Cleaning',
    slug: 'window-cleaning',
    description: 'Residential and commercial window cleaning',
    category: 'maintenance'
  },
  {
    id: 'pressure-washing',
    name: 'Pressure Washing',
    slug: 'pressure-washing',
    description: 'Exterior cleaning and pressure washing',
    category: 'maintenance'
  },

  // SPECIALTY CONTRACTORS
  {
    id: 'home-inspector',
    name: 'Home Inspection',
    slug: 'home-inspector',
    description: 'Professional home inspection services',
    category: 'specialty'
  },
  {
    id: 'architect',
    name: 'Architect',
    slug: 'architect',
    description: 'Architectural design and planning services',
    category: 'specialty'
  },
  {
    id: 'structural-engineer',
    name: 'Structural Engineering',
    slug: 'structural-engineer',
    description: 'Structural engineering and analysis',
    category: 'specialty'
  },
  {
    id: 'interior-designer',
    name: 'Interior Design',
    slug: 'interior-designer',
    description: 'Interior design and space planning',
    category: 'specialty'
  },
  {
    id: 'custom-cabinetry',
    name: 'Custom Cabinetry',
    slug: 'custom-cabinetry',
    description: 'Custom cabinet design and installation',
    category: 'specialty'
  },
  {
    id: 'countertop-installation',
    name: 'Countertop Installation',
    slug: 'countertop-installation',
    description: 'Granite, quartz, and marble countertop installation',
    category: 'specialty'
  },
  {
    id: 'appliance-repair',
    name: 'Appliance Repair',
    slug: 'appliance-repair',
    description: 'Home appliance repair and maintenance',
    category: 'maintenance'
  },
  {
    id: 'handyman',
    name: 'Handyman Services',
    slug: 'handyman',
    description: 'General repair and maintenance services',
    category: 'maintenance'
  }
];

export function getTradesByCategory(category: string): Trade[] {
  return COMPREHENSIVE_TRADES.filter(trade => trade.category === category);
}

export function getMainTrades(): Trade[] {
  return COMPREHENSIVE_TRADES.filter(trade => !trade.parentId);
}

export function getSubTrades(parentId: string): Trade[] {
  return COMPREHENSIVE_TRADES.filter(trade => trade.parentId === parentId);
}

export function getTradeById(id: string): Trade | undefined {
  return COMPREHENSIVE_TRADES.find(trade => trade.id === id);
}

export function getTradeBySlug(slug: string): Trade | undefined {
  return COMPREHENSIVE_TRADES.find(trade => trade.slug === slug);
}