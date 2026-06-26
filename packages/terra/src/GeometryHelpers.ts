import { isEnclosed } from './helpers';

export const isGeometryEnclosed = (typeid: number) => {
  return isEnclosed(typeid);
};
