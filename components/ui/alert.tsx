import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'warning' | 'success';
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ 
  children, 
  variant = 'default', 
  className = '' 
}) => {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-900 border-gray-300',
    destructive: 'bg-red-50 text-red-900 border-red-300',
    warning: 'bg-yellow-50 text-yellow-900 border-yellow-300',
    success: 'bg-green-50 text-green-900 border-green-300',
  };

  return (
    <div className={`p-4 rounded-md border ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
};

interface AlertDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const AlertDescription: React.FC<AlertDescriptionProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`text-sm ${className}`}>
      {children}
    </div>
  );
};