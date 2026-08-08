import { expect, test } from 'vitest'
import { geoUri, appleMapsUrl, googleDirectionsUrl, googleListingSearchUrl } from '../nav-links'

test('geo URI embeds coords and encoded label', () => {
  expect(geoUri(45.5218, -73.5837, 'Félix & Norton')).toBe(
    'geo:45.5218,-73.5837?q=45.5218,-73.5837(F%C3%A9lix%20%26%20Norton)'
  )
})

test('apple maps directions', () => {
  expect(appleMapsUrl(45.5218, -73.5837)).toBe('https://maps.apple.com/?daddr=45.5218,-73.5837')
})

test('google maps directions', () => {
  expect(googleDirectionsUrl(45.5218, -73.5837)).toBe(
    'https://www.google.com/maps/dir/?api=1&destination=45.5218%2C-73.5837'
  )
})

test('google listing search from name + address', () => {
  expect(googleListingSearchUrl('Félix & Norton', '5252 Boul. Saint-Laurent, Montréal')).toBe(
    'https://www.google.com/maps/search/?api=1&query=F%C3%A9lix%20%26%20Norton%205252%20Boul.%20Saint-Laurent%2C%20Montr%C3%A9al'
  )
})
