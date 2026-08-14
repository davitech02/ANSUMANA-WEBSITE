import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0 truncate">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            {idx > 0 && (
              <ChevronRight className="w-3 h-3 text-gray-400 shrink-0 dark:text-gray-500" />
            )}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="hover:text-[#0A2E24] dark:hover:text-[#D4AF37] whitespace-nowrap transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`truncate ${
                  isLast
                    ? 'text-[#0A2E24] font-semibold dark:text-[#D4AF37]'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};