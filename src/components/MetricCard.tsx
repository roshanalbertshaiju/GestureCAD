import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  description?: string;
  status?: 'success' | 'warning' | 'error' | 'neutral';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon: Icon,
  description,
  status = 'neutral',
}) => {
  const getStatusColors = () => {
    switch (status) {
      case 'success':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-700',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
        };
      case 'error':
        return {
          bg: 'bg-rose-50',
          border: 'border-rose-200',
          text: 'text-rose-700',
        };
      case 'neutral':
      default:
        return {
          bg: 'bg-zinc-50',
          border: 'border-zinc-200',
          text: 'text-zinc-700',
        };
    }
  };

  const colors = getStatusColors();

  return (
    <div className="glass-card p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden border border-zinc-200/80 bg-white">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">{title}</span>
        <div className={`p-2 rounded-xl ${colors.bg} ${colors.text} border ${colors.border} transition-colors duration-250`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight text-zinc-900">{value}</span>
          {unit && <span className="text-xs font-semibold text-zinc-400">{unit}</span>}
        </div>
        {description && (
          <p className="text-[11px] text-zinc-400 mt-1 font-medium">{description}</p>
        )}
      </div>
    </div>
  );
};
export default MetricCard;
