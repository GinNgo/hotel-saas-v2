import { VIETNAM_34_PROVINCES } from '../data/vietnam-provinces.data';
import { removeVietnameseAccents } from '../models/location.model';
import {
  DestinationSuggestionDto,
  LandmarkDto,
  PublicPropertyDto,
  TouristZoneDto,
} from '../models/public-booking.model';

interface GeoCoords {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Mapping of frontend province/destination identifiers to canonical backend tourist zone slugs
 * defined in LocationLookupService. Provinces without a backend tourist zone are omitted so
 * non-existent touristZoneSlug values are never emitted.
 */
export const CANONICAL_TOURIST_ZONE_SLUGS: Readonly<Record<string, string>> = {
  hanoi: 'ha-noi-pho-co',
  quangninh: 'ha-long',
  laocai: 'sa-pa',
  danang: 'da-nang',
  quangnam: 'hoi-an',
  khanhhoa: 'nha-trang',
  lamdong: 'da-lat',
  dalat: 'da-lat',
  binhthuan: 'phan-thiet-mui-ne',
  vungtau: 'vung-tau',
  bariavungtau: 'vung-tau',
  hcm: 'quan-1-tphcm',
  hochiminh: 'quan-1-tphcm',
  tphcm: 'quan-1-tphcm',
  kiengiang: 'phu-quoc',
  binhdinh: 'quy-nhon',
};

const PROVINCE_CENTROIDS: Readonly<Record<string, GeoCoords>> = {
  // North
  hanoi: { latitude: 21.0285, longitude: 105.8542 },
  quangninh: { latitude: 20.9599, longitude: 107.0425 },
  laocai: { latitude: 22.3380, longitude: 103.8448 },
  ninhbinh: { latitude: 20.2506, longitude: 105.9745 },
  haiphong: { latitude: 20.7254, longitude: 107.0457 },
  hagiang: { latitude: 22.8233, longitude: 104.9836 },
  caobang: { latitude: 22.6657, longitude: 106.2579 },
  hoabinh: { latitude: 20.6619, longitude: 105.0835 },
  yenbai: { latitude: 21.7667, longitude: 104.1333 },
  langson: { latitude: 21.8537, longitude: 106.7615 },
  // Central
  danang: { latitude: 16.0544, longitude: 108.2022 },
  quangnam: { latitude: 15.8801, longitude: 108.3380 },
  khanhhoa: { latitude: 12.2388, longitude: 109.1967 },
  hue: { latitude: 16.4637, longitude: 107.5909 },
  binhdinh: { latitude: 13.7830, longitude: 109.2197 },
  binhthuan: { latitude: 10.9333, longitude: 108.2833 },
  phuyen: { latitude: 13.0882, longitude: 109.0929 },
  quangbinh: { latitude: 17.5600, longitude: 106.2833 },
  quangtri: { latitude: 16.8163, longitude: 107.1003 },
  quangngai: { latitude: 15.3833, longitude: 109.1167 },
  // Highlands
  lamdong: { latitude: 11.9404, longitude: 108.4583 },
  daklak: { latitude: 12.6667, longitude: 108.0500 },
  kontum: { latitude: 14.5936, longitude: 108.2939 },
  gialai: { latitude: 13.9833, longitude: 108.0000 },
  // South & Mekong Delta
  hcm: { latitude: 10.7769, longitude: 106.7009 },
  vungtau: { latitude: 10.3460, longitude: 107.0843 },
  kiengiang: { latitude: 10.2289, longitude: 103.9572 },
  cantho: { latitude: 10.0452, longitude: 105.7469 },
  angiang: { latitude: 10.7000, longitude: 105.1167 },
  bentre: { latitude: 10.2434, longitude: 106.3756 },
  dongthap: { latitude: 10.2908, longitude: 105.7564 },
  tayninh: { latitude: 11.3100, longitude: 106.0983 },
  camau: { latitude: 8.6033, longitude: 104.7250 },
  binhduong: { latitude: 10.9225, longitude: 106.6975 },
};

const LANDMARK_COORDINATES: Readonly<Record<string, GeoCoords & { readonly canonicalSlug?: string }>> = {
  'ho-hoan-kiem': { latitude: 21.0285, longitude: 105.8542, canonicalSlug: 'ho-hoan-kiem' },
  'pho-co-36-pho-phuong': { latitude: 21.0340, longitude: 105.8500, canonicalSlug: 'pho-co-ha-noi' },
  'lang-bac': { latitude: 21.0368, longitude: 105.8346, canonicalSlug: 'lang-bac-ha-noi' },
  'vinh-ha-long': { latitude: 20.9101, longitude: 107.1839, canonicalSlug: 'vinh-ha-long' },
  'dao-tuan-chau': { latitude: 20.9298, longitude: 106.9922, canonicalSlug: 'dao-tuan-chau' },
  'sun-world-ha-long': { latitude: 20.9575, longitude: 107.0392, canonicalSlug: 'bai-chay-ha-long' },
  'dinh-fansipan': { latitude: 22.3033, longitude: 103.7753, canonicalSlug: 'dinh-fansipan' },
  'ban-cat-cat': { latitude: 22.3275, longitude: 103.8305 },
  'nha-tho-da-sa-pa': { latitude: 22.3354, longitude: 103.8427, canonicalSlug: 'nha-tho-da-sa-pa' },
  'quan-the-trang-an': { latitude: 20.2506, longitude: 105.9375 },
  'tam-coc-bich-dong': { latitude: 20.2170, longitude: 105.9220 },
  'bien-my-khe': { latitude: 16.0601, longitude: 108.2464, canonicalSlug: 'bai-bien-my-khe' },
  'cau-rong': { latitude: 16.0611, longitude: 108.2272, canonicalSlug: 'cau-rong-da-nang' },
  'ba-na-hills': { latitude: 15.9961, longitude: 107.9877, canonicalSlug: 'ba-na-hills' },
  'pho-co-hoi-an': { latitude: 15.8801, longitude: 108.3263, canonicalSlug: 'pho-co-hoi-an' },
  'chua-cau': { latitude: 15.8772, longitude: 108.3260, canonicalSlug: 'chua-cau-hoi-an' },
  'thap-tram-huong': { latitude: 12.2388, longitude: 109.1967, canonicalSlug: 'thap-tram-huong-nha-trang' },
  'bai-bien-tran-phu': { latitude: 12.2415, longitude: 109.1970, canonicalSlug: 'bai-bien-tran-phu' },
  'vinwonders': { latitude: 12.2198, longitude: 109.2435, canonicalSlug: 'vinwonders-nha-trang' },
  'dai-noi-hue': { latitude: 16.4698, longitude: 107.5786 },
  'eo-gio-nhon-ly': { latitude: 13.9242, longitude: 109.2882, canonicalSlug: 'eo-gio-quy-nhon' },
  'doi-cat-bay': { latitude: 10.9436, longitude: 108.2868, canonicalSlug: 'doi-cat-bay-mui-ne' },
  'ho-xuan-huong': { latitude: 11.9404, longitude: 108.4452, canonicalSlug: 'ho-xuan-huong' },
  'cho-dem-da-lat': { latitude: 11.9424, longitude: 108.4373, canonicalSlug: 'cho-dem-da-lat' },
  'quang-truong-lam-vien': { latitude: 11.9366, longitude: 108.4456, canonicalSlug: 'quang-truong-lam-vien' },
  'cho-ben-thanh': { latitude: 10.7725, longitude: 106.6980, canonicalSlug: 'cho-ben-thanh' },
  'pho-di-bo-nguyen-hue': { latitude: 10.7745, longitude: 106.7036, canonicalSlug: 'pho-di-bo-nguyen-hue' },
  'nha-tho-duc-ba': { latitude: 10.7798, longitude: 106.6990, canonicalSlug: 'nha-tho-duc-ba' },
  'bai-sau-vung-tau': { latitude: 10.3347, longitude: 107.0898, canonicalSlug: 'bai-sau-vung-tau' },
  'grand-world-phu-quoc': { latitude: 10.3235, longitude: 103.8580, canonicalSlug: 'grand-world-phu-quoc' },
  'cho-dem-phu-quoc': { latitude: 10.2185, longitude: 103.9610, canonicalSlug: 'cho-dem-phu-quoc' },
  'cho-noi-cai-rang': { latitude: 10.0040, longitude: 105.7478 },
  'ben-ninh-kieu': { latitude: 10.0326, longitude: 105.7872 },
};

export function slugifyVietnamese(value: string): string {
  return removeVietnameseAccents(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveCanonicalTouristZoneSlug(provinceIdOrSlug: string): string | null {
  const key = removeVietnameseAccents(provinceIdOrSlug).replace(/[^a-z0-9]/g, '');
  return CANONICAL_TOURIST_ZONE_SLUGS[key] ?? null;
}

export function buildDefaultDestinationSuggestions(): DestinationSuggestionDto[] {
  const list: DestinationSuggestionDto[] = [];

  for (const p of VIETNAM_34_PROVINCES) {
    const centroid = PROVINCE_CENTROIDS[p.id];
    const canonicalZoneSlug = resolveCanonicalTouristZoneSlug(p.id);

    list.push({
      id: `prov-${p.code}`,
      name: p.name,
      slug: p.id,
      type: 'Province',
      provinceCode: p.code,
      provinceName: p.name,
      touristZoneName: p.shortName !== p.name ? p.shortName : undefined,
      propertyCount: p.propertyCount,
      latitude: centroid?.latitude,
      longitude: centroid?.longitude,
    });

    if (p.touristZone) {
      // Only emit TouristZone type when a canonical backend tourist zone exists;
      // otherwise emit as Province so selecting it never passes a non-existent touristZoneSlug.
      list.push({
        id: canonicalZoneSlug ? `zone-${canonicalZoneSlug}` : `prov-zone-${p.id}`,
        name: p.touristZone,
        slug: canonicalZoneSlug ?? p.id,
        type: canonicalZoneSlug ? 'TouristZone' : 'Province',
        provinceCode: p.code,
        provinceName: p.name,
        touristZoneName: p.touristZone,
        latitude: centroid?.latitude,
        longitude: centroid?.longitude,
      });
    }

    for (const lm of p.hotLandmarks) {
      const normalizedSlug = slugifyVietnamese(lm);
      const lmInfo = LANDMARK_COORDINATES[normalizedSlug];
      const lmSlug = lmInfo?.canonicalSlug ?? normalizedSlug;

      list.push({
        id: `lm-${p.code}-${lmSlug}`,
        name: lm,
        slug: lmSlug,
        type: 'Landmark',
        provinceCode: p.code,
        provinceName: p.name,
        touristZoneName: p.touristZone,
        latitude: lmInfo?.latitude ?? centroid?.latitude,
        longitude: lmInfo?.longitude ?? centroid?.longitude,
      });
    }
  }

  return list;
}

export function mergeLiveDestinationCatalog(
  base: readonly DestinationSuggestionDto[],
  zones?: readonly TouristZoneDto[] | null,
  landmarks?: readonly LandmarkDto[] | null,
  properties?: readonly PublicPropertyDto[] | null
): DestinationSuggestionDto[] {
  const merged = new Map<string, DestinationSuggestionDto>();

  const toKey = (item: DestinationSuggestionDto): string => `${item.type}:${item.slug || item.id}`;

  for (const item of base) {
    merged.set(toKey(item), item);
  }

  if (zones && zones.length > 0) {
    for (const z of zones) {
      const item: DestinationSuggestionDto = {
        id: `zone-${z.slug}`,
        name: z.name,
        slug: z.slug,
        type: 'TouristZone',
        provinceCode: z.provinceCode,
        provinceName: z.provinceName,
        touristZoneName: z.name,
        latitude: z.latitude,
        longitude: z.longitude,
      };
      merged.set(toKey(item), item);
    }
  }

  if (landmarks && landmarks.length > 0) {
    for (const lm of landmarks) {
      const matchedZone = zones?.find(z => z.slug === lm.touristZoneSlug);
      const item: DestinationSuggestionDto = {
        id: `lm-${lm.provinceCode}-${lm.slug}`,
        name: lm.name,
        slug: lm.slug,
        type: 'Landmark',
        provinceCode: lm.provinceCode,
        provinceName: matchedZone?.provinceName ?? '',
        touristZoneName: matchedZone?.name,
        latitude: lm.latitude,
        longitude: lm.longitude,
      };
      merged.set(toKey(item), item);
    }
  }

  if (properties && properties.length > 0) {
    for (const prop of properties) {
      if (!prop.slug && !prop.propertyId) continue;
      const item: DestinationSuggestionDto = {
        id: `prop-${prop.propertyId || prop.slug}`,
        name: prop.name,
        slug: prop.slug,
        type: 'Property',
        provinceCode: prop.provinceCode || '',
        provinceName: prop.provinceName || prop.city || '',
        touristZoneName: prop.touristZoneName || prop.tenantBrandName || undefined,
        propertyType: prop.propertyType,
        latitude: prop.latitude,
        longitude: prop.longitude,
      };
      merged.set(toKey(item), item);
    }
  }

  return Array.from(merged.values());
}
