import type { Shop } from './shops'
import { SITE_NAME, SITE_URL } from './site'

// Pas d'aggregateRating : la note est un avis éditorial unique (celui de Cookies
// Club), pas une moyenne d'avis — un aggregateRating serait trompeur pour Google.
export function shopJsonLd(shop: Shop): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    name: shop.name,
    url: `${SITE_URL}/c/${shop.slug}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: shop.address,
      addressLocality: 'Montréal',
      addressRegion: 'QC',
      addressCountry: 'CA',
    },
    geo: { '@type': 'GeoCoordinates', latitude: shop.lat, longitude: shop.lng },
    review: {
      '@type': 'Review',
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      reviewRating: { '@type': 'Rating', ratingValue: shop.rating, bestRating: 5, worstRating: 0 },
      reviewBody: shop.review,
    },
  }
}

export function homeJsonLd(shops: Shop[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: SITE_NAME,
    url: SITE_URL,
    itemListElement: shops.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.name,
      url: `${SITE_URL}/c/${s.slug}`,
    })),
  }
}
