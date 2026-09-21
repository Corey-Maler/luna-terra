import { describe, expect, it, vi } from 'vitest';
import { Camera3D } from './Camera3D';
import { WebGL3DBackend } from './WebGL3DBackend';

describe('WebGL3DBackend ribbon state', () => {
  it('uploads one interleaved ribbon and restores plain triangle and line attributes', () => {
    const calls = new Map<string, ReturnType<typeof vi.fn>>();
    const gl = new Proxy({}, {
      get: (_target, name: string) => {
        if (name === name.toUpperCase()) return name;
        if (!calls.has(name)) {
          calls.set(name, vi.fn((...args: unknown[]) => {
            if (name === 'getAttribLocation') return args[1] === 'a_position' ? 0 : 1;
            if (name === 'getUniformLocation') return args[1];
            return true;
          }));
        }
        return calls.get(name);
      },
    }) as WebGL2RenderingContext;
    const backend = new WebGL3DBackend(gl);
    const camera = new Camera3D();
    const ribbon = new Float32Array(30);
    backend.drawRibbon(ribbon, '#ffffff', '#808080', camera, undefined, { polygonOffsetUnits: -80 });
    expect(calls.get('bufferData')).toHaveBeenLastCalledWith('ARRAY_BUFFER', ribbon, 'DYNAMIC_DRAW');
    expect(calls.get('drawArrays')).toHaveBeenLastCalledWith('TRIANGLES', 0, 6);
    expect(calls.get('vertexAttribPointer')).toHaveBeenCalledWith(0, 3, 'FLOAT', false, 20, 0);
    expect(calls.get('vertexAttribPointer')).toHaveBeenLastCalledWith(1, 2, 'FLOAT', false, 20, 12);
    expect(calls.get('uniform1i')).toHaveBeenLastCalledWith('u_isRibbon', 1);
    expect(calls.get('polygonOffset')).toHaveBeenLastCalledWith(0, -80);

    backend.drawTriangles(new Float32Array(9), '#ffffff', camera);
    expect(calls.get('vertexAttribPointer')).toHaveBeenLastCalledWith(0, 3, 'FLOAT', false, 0, 0);
    expect(calls.get('disableVertexAttribArray')).toHaveBeenLastCalledWith(1);
    expect(calls.get('uniform1i')).toHaveBeenLastCalledWith('u_isRibbon', 0);
    expect(calls.get('drawArrays')).toHaveBeenLastCalledWith('TRIANGLES', 0, 3);

    backend.drawRibbon(ribbon, '#ffffff', '#808080', camera);
    backend.drawLineStrips(new Float32Array(6), [0], [2], '#ffffff', camera);
    expect(calls.get('vertexAttribPointer')).toHaveBeenLastCalledWith(0, 3, 'FLOAT', false, 0, 0);
    expect(calls.get('disableVertexAttribArray')).toHaveBeenLastCalledWith(1);
    expect(calls.get('uniform1i')).toHaveBeenLastCalledWith('u_isRibbon', 0);
    expect(calls.get('drawArrays')).toHaveBeenLastCalledWith('LINE_STRIP', 0, 2);
  });
});
