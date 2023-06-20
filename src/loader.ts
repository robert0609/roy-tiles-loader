import { loadImage } from './utils/img';

interface ITile {
  // 当前瓦片一个像素代表原图多少个像素的比值
  unitsPerPixel: number;
  // 当前瓦片的z级别，z级别越大，代表放大倍数越大，显示越精细
  tileZ: number;
}

export interface ITilesLoaderOption {
  // 瓦片宽度
  tileWidth: number;
  // 瓦片高度
  tileHeight: number;
  // 原始底图的宽度
  originalImageWidth: number;
  // 原始底图的高度
  originalImageHeight: number;
  // 栅格瓦片url的格式，形如：https://img.xxx.com/xxxx/xxxx/{z}/{x}/{y}.png
  tileUrlPattern: string;
  // 栅格瓦片数据集
  tileSet: ITile[];
  // 渲染目标画布
  canvasElement: HTMLCanvasElement;
}

export class TilesLoader {
  private _canvas: HTMLCanvasElement;
  private _context: CanvasRenderingContext2D;
  private _tileSet: ITile[];

  /**
   * 可视范围宽度
   */
  get viewportWidth() {
    return this._canvas.width;
  }

  /**
   * 可视范围高度
   */
  get viewportHeight() {
    return this._canvas.height;
  }

  constructor(private options: ITilesLoaderOption) {
    this._canvas = options.canvasElement;
    this._tileSet = [...this.options.tileSet].sort(
      (a, b) => a.unitsPerPixel - b.unitsPerPixel
    );
    this._context = this._canvas.getContext('2d')!;
  }

  // 根据缩放级别返回每一级的瓦片纵向或者横向的数量
  private getTilesCountByZoom(zoom: number) {
    const currentUnitsPerPixel = Math.round(1 / zoom);
    let tile: ITile | undefined;
    for (let i = 0; i < this._tileSet.length; ++i) {
      if (this._tileSet[i].unitsPerPixel <= currentUnitsPerPixel) {
        tile = this._tileSet[i];
      } else {
        break;
      }
    }
    if (!tile) {
      return;
    }

    const maxTilesCount = Math.pow(2, tile.tileZ);
    const xTilesCount = Math.min(
      Math.ceil(
        (this.options.originalImageWidth * zoom) / this.options.tileWidth
      ),
      maxTilesCount
    );
    const yTilesCount = Math.min(
      Math.ceil(
        (this.options.originalImageHeight * zoom) / this.options.tileHeight
      ),
      maxTilesCount
    );
    return { xTilesCount, yTilesCount, tileZ: tile.tileZ };
  }

  async render() {
    // 获取当前画布的变换矩阵
    const transformMatrix = this._context.getTransform();
    // 获取缩放级别
    const zoom = transformMatrix.a;
    const tilesCountObj = this.getTilesCountByZoom(zoom);
    // 如果没有找到当前缩放级别所对应的瓦片数量，则该情况是没有生成对应这一级别的栅格瓦片，就不渲染
    if (tilesCountObj === undefined) {
      console.warn(`The tiles for zoom[${zoom}] are not found!`);
      return;
    }
    // 真实的底图的整体尺寸，是按照栅格瓦片的数量来计算的，不是实际底图的尺寸
    const tlPointReal = { x: 0, y: 0 };
    const brPointReal = {
      x: this.options.tileWidth * tilesCountObj.xTilesCount,
      y: this.options.tileHeight * tilesCountObj.yTilesCount
    };
    // 找到当前可视范围的区域
    const { tlPoint, brPoint } = this.getViewportArea();
    // 查找重合部分，即为当前需要渲染的底图区域
    const tl = {
      x: Math.max(tlPointReal.x, tlPoint.x),
      y: Math.max(tlPointReal.y, tlPoint.y)
    };
    const br = {
      x: Math.min(brPointReal.x, brPoint.x),
      y: Math.min(brPointReal.y, brPoint.y)
    };
    if (tl.x < br.x && tl.y < br.y) {
      // 此时会展示这个范围的底图，需要加载这个范围内的瓦片
      const xStart = Math.floor(tl.x / this.options.tileWidth);
      let xEnd = Math.floor(br.x / this.options.tileWidth);
      if (br.x % this.options.tileWidth === 0) {
        xEnd -= 1;
      }
      const yStart = Math.floor(tl.y / this.options.tileHeight);
      let yEnd = Math.floor(br.y / this.options.tileHeight);
      if (br.y % this.options.tileHeight === 0) {
        yEnd -= 1;
      }

      // 根据找到的x和y方向上的索引范围，找到所需要加载的瓦片地址
      const imgLoadPromises: Promise<void>[] = [];
      for (let x = xStart; x <= xEnd; ++x) {
        for (let y = yStart; y <= yEnd; ++y) {
          imgLoadPromises.push(this.drawTile(tilesCountObj.tileZ, x, y));
        }
      }

      await Promise.all(imgLoadPromises);
    } else {
      // 此时不渲染任何瓦片
      return;
    }
  }

  private async drawTile(z: number, x: number, y: number) {
    const imgUrl = this.options.tileUrlPattern
      .replace('{z}', z.toString())
      .replace('{x}', x.toString())
      .replace('{y}', y.toString());
    const img = await loadImage(imgUrl);
    this._context.drawImage(
      img,
      x * this.options.tileWidth,
      y * this.options.tileHeight
    );
  }

  private getViewportArea() {
    // 获取当前画布的变换矩阵
    const transformMatrix = this._context.getTransform();
    // 求逆矩阵
    const invertTransformMatrix = transformMatrix.invertSelf();

    const tlPoint = invertTransformMatrix.transformPoint({ x: 0, y: 0 });
    const brPoint = invertTransformMatrix.transformPoint({
      x: this.viewportWidth,
      y: this.viewportHeight
    });

    // 返回左上和右下两个点坐标
    return { tlPoint, brPoint };
  }
}
