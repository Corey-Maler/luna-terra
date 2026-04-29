import { generatedSymbolIndex } from '../generated/coreSymbols.generated';

const DOC_SYMBOL_ROUTES: Record<string, string> = {
  LunaTerraEngine: '/core/base#engine-api',
  CanvasRenderer: '/core/base#renderer-api',
  DrawContext: '/core/base#draw-context',
  WebGLDrawBackend: '/core/base#webgl-backend',
  ScreenContainer: '/core/base#screen-container',
  InteractionManager: '/core/base#interaction-manager',
  MouseEventHandlers: '/core/base#pointer-input',
  EditModeOptions: '/core/base#pointer-input',
  ItemDragModeOptions: '/core/base#pointer-input',
  LTElement: '/core/lt-element',
  V2: '/math/v2',
  M3: '/math/m3',
  Rect2D: '/math/rect2d',
  Color: '/color/color',
};

export function getDocSymbolHref(symbol: string): string | null {
  return DOC_SYMBOL_ROUTES[symbol] ?? null;
}

export function getDocSymbolTitle(symbol: string): string | undefined {
  const generated = generatedSymbolIndex[symbol];
  if (!generated) {
    return undefined;
  }

  return generated.docs || generated.summary;
}

export function hasGeneratedDocSymbol(symbol: string): boolean {
  return Boolean(generatedSymbolIndex[symbol]);
}