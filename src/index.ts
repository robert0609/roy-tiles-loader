import { TilesLoader } from './loader';
import { getConfig } from './config';
import type { ITilesLoaderOption } from './loader';
import { type } from 'os';
import { FabricTilesLoader } from './fabricLoader';

export type CanvasType = 'raw' | 'fabric';

export interface ITilesConfigOption {
  // 瓦片xml配置文件的url
  tilesConfigUrl: string;
  canvasType: CanvasType;
}

export type SimpleTilesLoaderOption = Pick<
  ITilesLoaderOption,
  'tileUrlPattern' | 'getTileUrlHook' | 'canvasElement' | 'loadTileImageHook'
> &
  ITilesConfigOption;

/**
 * 加载瓦片配置文件
 */
export async function getTilesConfig(options: ITilesConfigOption) {
  const tilesConfig = await getConfig(options.tilesConfigUrl);
  return tilesConfig;
}

/**
 * 基于xml的瓦片配置文件，自动读取并初始化瓦片加载器
 */
export async function getTilesLoaderByXmlConfig(
  options: SimpleTilesLoaderOption
) {
  const tilesConfig = await getTilesConfig(options);
  if (options.canvasType === 'fabric') {
    const loader = await new FabricTilesLoader({
      ...tilesConfig,
      tileUrlPattern: options.tileUrlPattern,
      getTileUrlHook: options.getTileUrlHook,
      canvasElement: options.canvasElement,
      loadTileImageHook: options.loadTileImageHook
    });
    return loader;
  } else {
    const loader = await new TilesLoader({
      ...tilesConfig,
      tileUrlPattern: options.tileUrlPattern,
      getTileUrlHook: options.getTileUrlHook,
      canvasElement: options.canvasElement,
      loadTileImageHook: options.loadTileImageHook
    });
    return loader;
  }
}

export { TilesLoader };
export type { ITilesConfig } from './config';
export type { ITile, ITilesLoaderOption, LoadTileImage } from './loader';
