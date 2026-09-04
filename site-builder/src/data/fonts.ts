import type { FontPairing, LayoutStyle } from '../types'

export const fontPairings: FontPairing[] = [
  {
    id: 'elegant',
    name: 'Élégant',
    heading: 'Playfair Display',
    body: 'Manrope',
    headingClass: 'font-display',
    bodyClass: 'font-sans',
  },
  {
    id: 'moderne',
    name: 'Moderne',
    heading: 'Space Grotesk',
    body: 'Space Grotesk',
    headingClass: 'font-tech',
    bodyClass: 'font-tech',
  },
  {
    id: 'minimal',
    name: 'Minimaliste',
    heading: 'Manrope',
    body: 'Manrope',
    headingClass: 'font-sans',
    bodyClass: 'font-sans',
  },
]

export const layoutStyles: LayoutStyle[] = [
  {
    id: 'grid',
    name: 'Grille Moderne',
    description: 'Cartes produits organisées, idéal pour de larges catalogues.',
  },
  {
    id: 'editorial',
    name: 'Éditorial',
    description: 'Grand hero visuel et mise en page magazine.',
  },
  {
    id: 'bold',
    name: 'Audacieux',
    description: 'Typographie XXL, contrastes forts, effet immersif.',
  },
]

export const findFontPairing = (id: string) => fontPairings.find((f) => f.id === id) ?? fontPairings[0]
export const findLayoutStyle = (id: string) => layoutStyles.find((l) => l.id === id) ?? layoutStyles[0]
