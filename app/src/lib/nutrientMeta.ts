// Etiquetas, iconos y colores de los nutrientes (presentación, no datos).

import { Candy, Droplet, Drumstick, Flame, Wheat } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { SaltIcon } from '../components/SaltIcon.tsx'
import type { CardNutrient } from './compute.ts'

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

export interface NutrientMeta {
  label: string
  Icon: IconComponent
  /** Clases de Tailwind para el icono y la barra. */
  text: string
  bar: string
}

export const NUTRIENT_META: Record<CardNutrient, NutrientMeta> = {
  kcal: { label: 'Calorías', Icon: Flame, text: 'text-kcal', bar: 'bg-kcal' },
  protein: { label: 'Proteínas', Icon: Drumstick, text: 'text-protein', bar: 'bg-protein' },
  carbs: { label: 'Hidratos', Icon: Wheat, text: 'text-carbs', bar: 'bg-carbs' },
  fat: { label: 'Grasas', Icon: Droplet, text: 'text-fat', bar: 'bg-fat' },
  sugars: { label: 'Azúcares', Icon: Candy, text: 'text-sugars', bar: 'bg-sugars' },
  salt: { label: 'Sal', Icon: SaltIcon, text: 'text-salt', bar: 'bg-salt' },
}
