import { XMLParser } from 'fast-xml-parser';
import type { ITile } from './loader';

export interface ITilesConfig {
  // 瓦片宽度
  tileWidth: number;
  // 瓦片高度
  tileHeight: number;
  // 原始底图的宽度
  originalImageWidth: number;
  // 原始底图的高度
  originalImageHeight: number;
  // 栅格瓦片数据集
  tileSet: ITile[];
}

export async function getConfig(xmlConfigUrl: string): Promise<ITilesConfig> {
  const res = await fetch(xmlConfigUrl, {
    method: 'GET',
    mode: 'cors'
  });
  if (res.status === 200) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      allowBooleanAttributes: true,
      trimValues: true,
      attributeNamePrefix: ''
    });
    const { TileMap } = parser.parse(await res.text());
    return {
      tileWidth: Number(TileMap.TileFormat.width),
      tileHeight: Number(TileMap.TileFormat.height),
      originalImageWidth:
        Number(TileMap.BoundingBox.maxx) - Number(TileMap.BoundingBox.minx),
      originalImageHeight:
        Number(TileMap.BoundingBox.maxy) - Number(TileMap.BoundingBox.miny),
      tileSet: TileMap.TileSets.TileSet.map((t: any) => ({
        unitsPerPixel: Number(t['units-per-pixel']),
        tileZ: Number(t['href'])
      }))
    };
  } else {
    throw new Error(`加载瓦片配置失败：${xmlConfigUrl}`);
  }
}
