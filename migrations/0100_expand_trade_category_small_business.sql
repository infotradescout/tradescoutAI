-- Expand trade_category enum to cover general/retail small businesses,
-- not just construction trades. Additive only; existing values untouched.
-- The construction enum itself entered some databases through schema push.
-- A clean journal therefore creates the complete active type up front; the
-- additive statements below remain the safe path for older deployed enums.
DO $$
BEGIN
  CREATE TYPE public.trade_category AS ENUM (
    'general_contractor',
    'construction_manager',
    'project_manager',
    'concrete_contractor',
    'foundation_specialist',
    'masonry_contractor',
    'structural_engineer',
    'roofing_contractor',
    'siding_contractor',
    'window_installer',
    'door_installer',
    'insulation_contractor',
    'electrician',
    'low_voltage_technician',
    'solar_installer',
    'security_system_installer',
    'smart_home_specialist',
    'plumber',
    'hvac_contractor',
    'refrigeration_technician',
    'water_heater_specialist',
    'septic_contractor',
    'flooring_contractor',
    'tile_contractor',
    'carpet_installer',
    'painter',
    'drywall_contractor',
    'cabinet_maker',
    'countertop_installer',
    'kitchen_remodeler',
    'bathroom_remodeler',
    'appliance_installer',
    'landscaper',
    'hardscape_contractor',
    'pool_contractor',
    'fence_contractor',
    'deck_builder',
    'outdoor_lighting',
    'home_inspector',
    'mold_remediation',
    'water_damage_restoration',
    'pest_control',
    'cleaning_service',
    'handyman',
    'maintenance_contractor',
    'salon_barbershop',
    'spa_wellness',
    'bakery_cafe',
    'restaurant_food_service',
    'retail_shop',
    'boutique_apparel',
    'florist',
    'pet_grooming_services',
    'childcare_provider',
    'tutor_education_services',
    'photographer_videographer',
    'event_planner',
    'auto_repair_service',
    'laundry_dry_cleaning',
    'fitness_instructor',
    'bookkeeping_accounting',
    'marketing_creative_services',
    'general_small_business'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'salon_barbershop';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'spa_wellness';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'bakery_cafe';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'restaurant_food_service';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'retail_shop';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'boutique_apparel';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'florist';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'pet_grooming_services';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'childcare_provider';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'tutor_education_services';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'photographer_videographer';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'event_planner';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'auto_repair_service';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'laundry_dry_cleaning';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'fitness_instructor';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'bookkeeping_accounting';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'marketing_creative_services';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'general_small_business';
