/** Presentation experiment; URL choice survives the existing navigation projection. */
export type IdentityTypographyVariant = 'editorial' | 'expressive-initial'
export const defaultIdentityTypographyVariant: IdentityTypographyVariant = 'editorial'

export function readIdentityTypographyVariant(search: URLSearchParams): IdentityTypographyVariant {
  const requested = search.get('typography')
  return requested === 'editorial' || requested === 'expressive-initial'
    ? requested : defaultIdentityTypographyVariant
}

export const defaultIdentityPlacement = 'stage'
export function readIdentityPlacement(search: URLSearchParams): 'stage' | 'header' {
  return search.get('identity') === 'header' ? 'header' : defaultIdentityPlacement
}
