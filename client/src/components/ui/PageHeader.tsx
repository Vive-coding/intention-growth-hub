import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Filter } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  showAddButton?: boolean;
  addButtonText?: string;
  addButtonIcon?: React.ReactNode;
  onAddClick?: () => void;
  filters?: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  }[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon,
  showAddButton = true,
  addButtonText = "Add",
  addButtonIcon = <Plus className="w-4 h-4" />,
  onAddClick,
  filters = [],
  className = ""
}) => {
  return (
    <Card className={`shadow-md border-0 bg-white/80 backdrop-blur-sm ${className}`}>
      <CardHeader>
        <div className="flex flex-col space-y-4">
          {/* Title and Add Button Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon}
              <div>
                <CardTitle className="text-lg sm:text-xl font-semibold text-gray-800">
                  {title}
                </CardTitle>
                <p className="text-gray-600 mt-1 text-sm sm:text-base">
                  {description}
                </p>
              </div>
            </div>
            
            {showAddButton && onAddClick && (
              <Button 
                onClick={onAddClick}
                className="bg-indigo-600 hover:bg-indigo-700 text-sm sm:text-base px-3 sm:px-4 py-2"
              >
                {addButtonIcon}
                <span className="hidden sm:inline ml-2">{addButtonText}</span>
              </Button>
            )}
          </div>

          {/* Filters Row - Mobile Optimized */}
          {filters.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              {/* Mobile: Stack filters vertically */}
              <div className="block sm:hidden space-y-3">
                {filters.map((filter, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {filter.label}
                    </span>
                    <Select value={filter.value} onValueChange={filter.onChange}>
                      <SelectTrigger className="w-32 bg-white border-gray-200">
                        <SelectValue placeholder={filter.label} />
                      </SelectTrigger>
                      <SelectContent>
                        {filter.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              
              {/* Desktop: Horizontal layout */}
              <div className="hidden sm:flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Filter className="w-4 h-4" />
                  <span>Filters:</span>
                </div>
                
                {filters.map((filter, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                      {filter.label}
                    </span>
                    <Select value={filter.value} onValueChange={filter.onChange}>
                      <SelectTrigger className="w-32 lg:w-40">
                        <SelectValue placeholder={filter.label} />
                      </SelectTrigger>
                      <SelectContent>
                        {filter.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
};
