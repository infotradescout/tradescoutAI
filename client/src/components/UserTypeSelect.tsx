import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { ACCOUNT_CREATION_USER_TYPES, USER_TYPES, USER_TYPE_CATEGORIES, getUserTypesByCategory } from '@shared/userTypes';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UserTypeSelectProps {
  selectedTypes: string[];
  onChange: (types: string[]) => void;
  maxSelection?: number;
  className?: string;
}

export function UserTypeSelect({ 
  selectedTypes, 
  onChange, 
  maxSelection,
  className 
}: UserTypeSelectProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('property');
  const selectableTypeIds = new Set(ACCOUNT_CREATION_USER_TYPES);

  const toggleType = (typeId: string) => {
    // Admin and other backend-only roles are not user-selectable.
    if (!selectableTypeIds.has(typeId)) return;

    if (selectedTypes.includes(typeId)) {
      onChange(selectedTypes.filter(id => id !== typeId));
    } else {
      if (maxSelection && selectedTypes.length >= maxSelection) {
        return; // Max selection reached
      }
      onChange([...selectedTypes, typeId]);
    }
  };

  const categories = Object.entries(USER_TYPE_CATEGORIES);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-semibold">I am a... (select all that apply)</h3>
          <p className="text-sm text-muted-foreground">
            This helps us customize your experience
            {maxSelection && ` • Select up to ${maxSelection}`}
          </p>
        </div>
        {selectedTypes.length > 0 && (
          <Badge variant="secondary" className="text-sm">
            {selectedTypes.length} selected
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {categories.map(([categoryKey, category]) => {
          const typesInCategory = getUserTypesByCategory(categoryKey).filter((t) => selectableTypeIds.has(t.id));
          const isExpanded = expandedCategory === categoryKey;
          const selectedInCategory = typesInCategory.filter(t => 
            selectedTypes.includes(t.id)
          ).length;

          return (
            <Card key={categoryKey} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedCategory(isExpanded ? null : categoryKey)}
                className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-primary text-xl">
                      {/* Icon placeholder - you can use lucide-react icons here */}
                      {category.icon === 'Home' && '🏠'}
                      {category.icon === 'Briefcase' && '💼'}
                      {category.icon === 'Wrench' && '🔧'}
                      {category.icon === 'Building' && '🏢'}
                      {category.icon === 'Car' && '🚗'}
                      {category.icon === 'Users' && '👥'}
                      {category.icon === 'Star' && '⭐'}
                    </span>
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold">{category.label}</h4>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedInCategory > 0 && (
                    <Badge variant="default" className="mr-2">
                      {selectedInCategory}
                    </Badge>
                  )}
                  <svg
                    className={cn(
                      'w-5 h-5 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {typesInCategory.map(type => {
                    const isSelected = selectedTypes.includes(type.id);
                    const isDisabled = Boolean(
                      !isSelected && maxSelection !== undefined && selectedTypes.length >= maxSelection
                    );

                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => !isDisabled && toggleType(type.id)}
                        disabled={isDisabled}
                        className={cn(
                          'relative flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all',
                          'hover:border-primary/50 hover:bg-accent/30',
                          isSelected && 'border-primary bg-primary/5',
                          isDisabled && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className={cn(
                          'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-sm">{type.label}</h5>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {type.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {selectedTypes.length > 0 && (
        <div className="mt-4 p-4 bg-accent/30 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Check className="w-4 h-4 text-primary" />
            Your Selected Roles
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedTypes.map(typeId => {
              const metadata = USER_TYPES[typeId];
              const isSelectable = selectableTypeIds.has(typeId);
              return metadata ? (
                <Badge
                  key={typeId}
                  variant="secondary"
                  className={cn(
                    'px-3 py-1.5',
                    isSelectable ? 'cursor-pointer hover:bg-destructive/20' : 'opacity-80 cursor-default'
                  )}
                  onClick={isSelectable ? () => toggleType(typeId) : undefined}
                >
                  {metadata.label}
                  {isSelectable && <span className="ml-2">×</span>}
                </Badge>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default UserTypeSelect;
