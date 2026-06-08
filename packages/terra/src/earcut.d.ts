declare module 'earcut' {
  function earcut(
    data: ArrayLike<number>,
    holeIndices?: number[],
    dim?: number
  ): number[];
  namespace earcut {
    function flatten(
      data: number[][][]
    ): { vertices: number[]; holes: number[]; dimensions: number };
    function deviation(
      data: ArrayLike<number>,
      holeIndices: number[] | undefined,
      dim: number,
      triangles: number[]
    ): number;
  }
  export = earcut;
}
