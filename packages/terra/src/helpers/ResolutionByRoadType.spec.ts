import { describe, expect, it } from 'vitest';
import {
  LAND_MASK_TYPE_ID,
  LAND_MASK_MAX_DEPTH,
  getFeatureTypeById,
  getZoomLevelByTags,
  getZoomLevelByTypeId,
  typeidByTags,
} from './ResolutionByRoadType';

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
    expect(getZoomLevelByTags({ building: 'house' })).toBe(16);
  });

  it('maps generated land masks as enclosed base features', () => {
    expect(getZoomLevelByTypeId(LAND_MASK_TYPE_ID)).toBe(0);
    expect(LAND_MASK_MAX_DEPTH).toBe(16);
    expect(getFeatureTypeById(LAND_MASK_TYPE_ID)).toMatchObject({
      kind: 'mask',
      name: 'land_mask',
      enclosed: true,
    });
  });
});
