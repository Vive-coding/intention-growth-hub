import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type LifeMetricName =
  | 'Health & Fitness'
  | 'Career Growth'
  | 'Personal Development'
  | 'Relationships'
  | 'Finance'
  | 'Mental Health';

export const LIFE_METRIC_COLORS: Record<string, { text: string; bg: string; hex: string }> = {
  // New emoji names (primary)
  'Health & Fitness 🏃‍♀️': { text: 'text-green-600', bg: 'bg-green-100', hex: '#16a34a' },
  'Career Growth 🚀': { text: 'text-blue-600', bg: 'bg-blue-100', hex: '#2563eb' },
  'Personal Development 🧠': { text: 'text-purple-600', bg: 'bg-purple-100', hex: '#7c3aed' },
  'Relationships ❤️': { text: 'text-orange-600', bg: 'bg-orange-100', hex: '#ea580c' },
  'Finance 💰': { text: 'text-red-600', bg: 'bg-red-100', hex: '#dc2626' },
  'Mental Health 🧘‍♂️': { text: 'text-purple-600', bg: 'bg-purple-100', hex: '#7c3aed' },
  
  // Old names (fallback for backward compatibility)
  'Health & Fitness': { text: 'text-green-600', bg: 'bg-green-100', hex: '#16a34a' },
  'Career Growth': { text: 'text-blue-600', bg: 'bg-blue-100', hex: '#2563eb' },
  'Personal Development': { text: 'text-purple-600', bg: 'bg-purple-100', hex: '#7c3aed' },
  Relationships: { text: 'text-orange-600', bg: 'bg-orange-100', hex: '#ea580c' },
  Finance: { text: 'text-red-600', bg: 'bg-red-100', hex: '#dc2626' },
  'Mental Health': { text: 'text-purple-600', bg: 'bg-purple-100', hex: '#7c3aed' },
};

export function getLifeMetricColors(name?: string): { text: string; bg: string; hex: string } {
  if (!name) {
    return { text: 'text-gray-600', bg: 'bg-gray-100', hex: '#9ca3af' };
  }
  return LIFE_METRIC_COLORS[name] || { text: 'text-gray-600', bg: 'bg-gray-100', hex: '#9ca3af' };
}
