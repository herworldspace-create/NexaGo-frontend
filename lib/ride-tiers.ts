import { Bus, Car, CarTaxiFront, Motorbike, Package, type LucideIcon } from 'lucide-react'
import type { VehicleCategory } from './api'

export type RideTierKey = 'bike' | 'keke' | 'car' | 'xl' | 'delivery'

export type RideTier = {
  key: RideTierKey
  label: string
  tagline: string
  capacity: number
  icon: LucideIcon
}

export const rideTiers: Record<RideTierKey, RideTier> = {
  bike: { key: 'bike', label: 'Nexa Bike', tagline: 'Beat traffic, lowest fare', capacity: 1, icon: Motorbike },
  keke: { key: 'keke', label: 'Nexa Keke', tagline: 'Affordable short hops', capacity: 3, icon: CarTaxiFront },
  car: { key: 'car', label: 'Nexa Car', tagline: 'Comfortable AC rides', capacity: 4, icon: Car },
  xl: { key: 'xl', label: 'Nexa XL', tagline: 'Extra room for groups', capacity: 6, icon: Bus },
  delivery: { key: 'delivery', label: 'Nexa Delivery', tagline: 'Send packages across town', capacity: 0, icon: Package },
}

export const rideTierOrder: RideTierKey[] = ['bike', 'keke', 'car', 'xl', 'delivery']

export function tierKeyForCategory(category: VehicleCategory): RideTierKey {
  if (category.type === 'DELIVERY') return 'delivery'
  const value = `${category.code} ${category.name}`.toLowerCase()
  if (/bike|okada|motor/.test(value)) return 'bike'
  if (/keke|tricycle|napep/.test(value)) return 'keke'
  if (/\bxl\b|van|bus|suv|max|group/.test(value)) return 'xl'
  return 'car'
}
