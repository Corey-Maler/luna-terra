export const R = {
  world: 0,
  huge: 4,
  big: 6,
  large: 8,
  medium: 10,
  small: 11,
  micro: 12,
  nano: 13,
  UNKNOWN: 14,
  ignore: 55,
};

export const ColorByRoadType: Record<string, string> = {
  trunk: 'red',
  primary: 'green',
  tertiary: 'yellow',
  service: 'black',
  residential: '#3399ff',
  path: '#3333ff',
  unclassified: '#333399',
  cycleway: '#333333',
  footway: '#990000',
  pedestrian: '#990033',
  track: '#990066',
  raceway: '#990099',
  trunk_link: '#9900cc',
  platform: '#993300',
  steps: '#993333',
  living_street: '#993366',
  secondary: '#993399',
  tertiary_link: '#9933cc',
  secondary_link: '#996600',
  motorway_link: '#996633',
  motorway: '#996666',
  bridleway: '#996699',
  primary_link: '#9966cc',
  road: '#999900',
  construction: '#999933',
  proposed: '#999966',
  disused: '#999999',
  busway: '#9999cc',
  corridor: '#9999ff',
  elevator: '#99cc00',
  rest_area: '#99cc33',
  crossing: '#99cc66',
};

export const ResolutionByRoadType: Record<string, number> = {
  trunk: R.huge,
  primary: R.huge,
  tertiary: R.large,
  service: R.nano,
  residential: R.micro,
  path: R.nano,
  unclassified: R.nano,
  cycleway: R.nano,
  footway: R.nano,
  pedestrian: R.nano,
  track: R.small,
  raceway: R.small,
  trunk_link: R.big,
  platform: R.nano,
  steps: R.nano,
  living_street: R.small,
  secondary: R.large,
  tertiary_link: R.medium,
  secondary_link: R.medium,
  motorway_link: R.huge,
  motorway: R.huge,
  bridleway: R.small,
  primary_link: R.large,
  road: R.small,
  construction: R.nano,
  proposed: R.nano,
  disused: R.nano,
  busway: R.small,
  corridor: R.nano,
  elevator: R.nano,
  rest_area: R.micro,
  crossing: R.nano,
};

export const ResolutionByNaturalType: Record<string, number> = {
  coastline: R.world,
  water: R.world,
  wood: R.big,
  beach: R.medium,
  scrub: R.medium,
  cliff: R.small,
  stone: R.nano,
  sand: R.nano,
  heath: R.nano,
  wetland: R.nano,
  tree_row: R.nano,
  scree: R.ignore,
  grassland: R.nano,
  gravel: R.nano,
  shoal: R.ignore,
  grass: R.ignore,
  fell: R.ignore,
  rock: R.ignore,
  bare_rock: R.ignore,
  cave_entrance: R.ignore,
  ridge: R.ignore,
  reef: R.ignore,
  earth_bank: R.ignore,
  peninsula: R.ignore,
  shingle: R.ignore,
  arete: R.ignore,
  valley: R.ignore,
  shrubbery: R.ignore,
  gully: R.ignore,
};

const buildingTypes = [
  'yes', 'mall', 'school', 'retail', 'government', 'office', 'transportation',
  'hotel', 'university', 'apartments', 'construction', 'stadium', 'church',
  'civic', 'kindergarten', 'service', 'commercial', 'residential', 'terrace',
  'fire_station', 'cathedral', 'public', 'roof', 'house', 'mosque', 'ruin',
  'industrial', 'club', 'silo', 'detached', 'kiosk', 'hangar', 'weight_station',
  'sports_centre', 'hospital', 'train_station', 'garage', 'no', 'monastery',
  'carport', 'collapsed', 'shed', 'supermarket', 'warehouse', 'livestock',
  'chapel', 'bridge', 'casino', 'storage_tank', 'stable', 'greenhouse',
  'manufacture', 'ruins', 'bunker', 'hut', 'farm_auxiliary', 'lighthouse',
  'garages', 'fort', 'tower', 'farm', 'sport', 'airport_terminal', 'barn',
  'municipality_offices', 'dormitory', 'grandstand', 'houseboat',
  'semidetached_house', 'museum', 'parking', 'static_caravan', 'college',
  'offices', 'marketplace', 'toilets', 'restaurant', 'yurt', 'yes;mosque',
  'bungalow', 'shelter', 'factory', 'tent', 'sports_hall', 'cabin',
  'Medichic center', 'duplex', 'fire_lookout', 'military', 'allotment_house',
  'temple', 'container', 'beach_hut', 'The Corner One', 'outbuilding',
  'pavilion', 'gazebo', 'reservoir', 'gatehouse', 'amenity', 'guardhouse',
  'proposed',
];

const hwTypes = Object.keys(ResolutionByRoadType);
const naturalTypes = Object.keys(ResolutionByNaturalType);

const padding = 100 - hwTypes.length;
for (let i = 0; i < padding; i++) {
  hwTypes.push(`unknown${i}`);
}

const h2 = [...hwTypes, ...naturalTypes];

const padding2 = 200 - h2.length;
for (let i = 0; i < padding2; i++) {
  h2.push(`unknown${i}`);
}

export const highwayTypes = [...h2, ...buildingTypes];

const enclosed = new Set(['water', 'wood', ...buildingTypes]);

export const isEnclosed = (metaType: number) =>
  metaType >= 100 && enclosed.has(highwayTypes[metaType]);

export const typeidByTags = (tags: Record<string, string>) => {
  if ('highway' in tags) {
    return highwayTypes.findIndex((type) => type === tags.highway) ?? -1;
  }
  if ('building' in tags) {
    return highwayTypes.findIndex((type) => type === tags.building) ?? -1;
  }
  return 1;
};

export const getZoomLevelByTypeId = (typeId: number) => {
  if (typeId < 0) return R.UNKNOWN;
  if (typeId < 100) return ResolutionByRoadType[highwayTypes[typeId]] ?? R.UNKNOWN;
  if (typeId < 200) return ResolutionByNaturalType[highwayTypes[typeId]] ?? R.UNKNOWN;
  if (typeId < 300) return R.nano;
  return R.UNKNOWN;
};

export const getZoomLevelByTags = (tags: Record<string, string>) => {
  if ('highway' in tags) {
    return ResolutionByRoadType[tags.highway] ?? R.UNKNOWN;
  }
  if ('natural' in tags) {
    return ResolutionByNaturalType[tags.natural] ?? R.UNKNOWN;
  }
  if ('building' in tags) {
    return R.nano;
  }
  return R.UNKNOWN;
};
