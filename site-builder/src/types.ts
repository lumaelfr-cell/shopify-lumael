export type NicheId =
  | 'mode'
  | 'beaute'
  | 'tech'
  | 'maison'
  | 'gourmet'
  | 'sport'
  | 'bijoux'
  | 'enfants'
  | 'animaux'
  | 'bienetre'

export interface Product {
  name: string
  price: string
  emoji: string
  tag?: string
}

export interface ShopTemplate {
  id: string
  name: string
  tagline: string
  description: string
  emoji: string
  products: Product[]
  badge?: string
}

export interface Niche {
  id: NicheId
  label: string
  icon: string
  description: string
  defaultPaletteId: string
  shops: ShopTemplate[]
}

export interface Palette {
  id: string
  name: string
  primary: string
  secondary: string
  accent: string
  bg: string
  surface: string
  text: string
}

export interface FontPairing {
  id: string
  name: string
  heading: string
  body: string
  headingClass: string
  bodyClass: string
}

export interface LayoutStyle {
  id: string
  name: string
  description: string
}
