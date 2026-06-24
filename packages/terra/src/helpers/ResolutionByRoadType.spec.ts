import { describe, expect, it } from 'vitest';
import { getFeatureTypeById, getZoomLevelByTypeId, typeidByTags } from './ResolutionByRoadType';

describe('ResolutionByRoadType taxonomy', () => {
  it('keeps duplicate names in separate tag namespaces', () => {
    expect(typeidByTags({ highway: 'residential' })).toBe(4);
    expect(typeidByTags({ building: 'residential' })).toBe(217);
    expect(typeidByTags({ waterway: 'river' })).toBe(400);
    expect(typeidByTags({ landuse: 'forest' })).toBe(500);
    expect(typeidByTags({ aeroway: 'runway' })).toBe(601);
  });

  it('maps numeric type ids to readable feature descriptors', () => {
    expect(getFeatureTypeById(401)).toMatchObject({
      kind: 'waterway',
      name: 'stream',
      enclosed: false,
    });
    expect(getFeatureTypeById(500)).toMatchObject({
      kind: 'landuse',
      name: 'forest',
      enclosed: true,
    });
  });

  it('keeps buildings at the deepest tile level', () => {
    expect(getZoomLevelByTypeId(200)).toBe(16);
    expect(getZoomLevelByTypeId(217)).toBe(16);
  });
});
