import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  footer?: React.ReactNode;
}

export function Card({ 
  title, 
  subtitle, 
  children, 
  className = '', 
  padding = true,
  footer 
}: CardProps) {
  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-gray-200">
          {title && <h3 className="text-lg font-medium text-gray-900">{title}</h3>}
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
      )}
      <div className={padding ? 'p-6' : ''}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-3 bg-gray-50 rounded-b-lg">
          {footer}
        </div>
      )}
    </div>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export default Card;