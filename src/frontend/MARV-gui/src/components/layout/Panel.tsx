import React from 'react';

interface PanelProps {
  title?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

// Standard panel container for consistent visual design
export const Panel: React.FC<PanelProps> = ({ title, actions, className = '', children, headerRight }) => {
  return (
    <div className={`panel h-full flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}> 
      {(title || actions || headerRight) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-slate-50 rounded-t-lg flex-shrink-0">
          <h3 className="text-sm font-semibold tracking-wide text-slate-800 select-none uppercase">{title}</h3>
          <div className="flex items-center space-x-2">{actions}{headerRight}</div>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
};

export default Panel;