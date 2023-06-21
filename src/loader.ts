import { loadImage } from './utils/img';

export interface ITile {
  // 当前瓦片一个像素代表原图多少个像素的比值
  unitsPerPixel: number;
  // 当前瓦片的z级别，z级别越大，代表放大倍数越大，显示越精细
  tileZ: number;
}

export type LoadTileImage = (imgUrl: string) => Promise<HTMLImageElement>;

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
  // 加载栅格瓦片的钩子，如果设置了，会取代默认的加载图片的方法
  loadTileImageHook?: LoadTileImage;
}

export class TilesLoader {
  private _canvas: HTMLCanvasElement;
  private _context: CanvasRenderingContext2D;
  private _tileSet: ITile[];
  // 当前使用的瓦片数据集
  private _currentTileSet?: ITile;

  // 当前瓦片数据集，x和y两个方向上的最大瓦片数量
  private _xTilesCount = 0;
  private _yTilesCount = 0;
  // 当前瓦片数据集，拼接成的底图的宽度和高度
  private _fullImageWidth = 0;
  private _fullImageHeight = 0;

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

  // 根据当前zoom确定所要使用的瓦片数据集
  private checkTileSet(zoom: number) {
    const currentUnitsPerPixel = Math.round(1 / zoom);
    let newTileSet: ITile | undefined;
    for (let i = 0; i < this._tileSet.length; ++i) {
      if (this._tileSet[i].unitsPerPixel <= currentUnitsPerPixel) {
        newTileSet = this._tileSet[i];
      } else {
        break;
      }
    }

    let tileSetIsChanged = false;
    if (
      (!this._currentTileSet && !!newTileSet) ||
      (!!this._currentTileSet && !newTileSet)
    ) {
      tileSetIsChanged = true;
    } else if (!!this._currentTileSet && !!newTileSet) {
      if (this._currentTileSet.tileZ !== newTileSet.tileZ) {
        tileSetIsChanged = true;
      }
    }

    this._currentTileSet = newTileSet;

    return tileSetIsChanged;
  }

  // 根据当前使用的瓦片数据集和原图的尺寸，计算纵横的最大瓦片数量
  private computeMaxTilesCount(tile: ITile) {
    const maxTilesCount = Math.pow(2, tile.tileZ);
    const xTilesCount = Math.min(
      Math.ceil(
        this.options.originalImageWidth /
          tile.unitsPerPixel /
          this.options.tileWidth
      ),
      maxTilesCount
    );
    const yTilesCount = Math.min(
      Math.ceil(
        this.options.originalImageHeight /
          tile.unitsPerPixel /
          this.options.tileHeight
      ),
      maxTilesCount
    );

    return { xTilesCount, yTilesCount };
  }

  private onTileSetChanged() {
    // 如果当前使用的数据集存在的话
    if (!!this._currentTileSet) {
      const { xTilesCount, yTilesCount } = this.computeMaxTilesCount(
        this._currentTileSet
      );
      this._xTilesCount = xTilesCount;
      this._yTilesCount = yTilesCount;

      this._fullImageWidth = this.options.tileWidth * this._xTilesCount;
      this._fullImageHeight = this.options.tileHeight * this._yTilesCount;
    } else {
      this._xTilesCount = 0;
      this._yTilesCount = 0;

      this._fullImageWidth = 0;
      this._fullImageHeight = 0;
    }
  }

  async render() {
    // 获取当前画布的变换矩阵
    const transformMatrix = this._context.getTransform();
    // 找到当前可视范围的区域
    const { tlPointView, brPointView } = this.getViewportArea();
    // 获取缩放级别
    const zoom = transformMatrix.a;
    // 判断是否使用的瓦片数据集发生了变化
    const tileSetIsChanged = this.checkTileSet(zoom);
    if (tileSetIsChanged) {
      this.onTileSetChanged();
      // TODO:使用的瓦片集发生变化的时候，不须diff，重新渲染整个可视范围内的瓦片底图
    } else {
      // TODO:未发生变化的时候，只需要diff不同的部分渲染即可
    }

    // 如果没有找到当前缩放级别所对应的瓦片数量，则该情况是没有生成对应这一级别的栅格瓦片，就不渲染
    if (
      this._currentTileSet === undefined ||
      this._xTilesCount === 0 ||
      this._yTilesCount === 0
    ) {
      console.warn(`The tiles for zoom[${zoom}] are not found!`);
      return;
    }
    // 真实的底图的整体尺寸，是按照栅格瓦片的数量来计算的，不是实际底图的尺寸
    const tlPointReal = { x: 0, y: 0 };
    const brPointReal = {
      x: this._fullImageWidth,
      y: this._fullImageHeight
    };
    // 查找重合部分，即为当前需要渲染的底图区域
    const tl = {
      x: Math.max(tlPointReal.x, tlPointView.x),
      y: Math.max(tlPointReal.y, tlPointView.y)
    };
    const br = {
      x: Math.min(brPointReal.x, brPointView.x),
      y: Math.min(brPointReal.y, brPointView.y)
    };
    if (tl.x < br.x && tl.y < br.y) {
      // 该分支是有重合部分的情况，即需要刷新渲染瓦片而不是清除画布
      // 因为存在瓦片底图与可视窗口部分重合的情况，因此需要清除在可视窗口内但不属于瓦片底图的那部分画布
      if (tlPointView.x < tl.x) {
        this._context.clearRect(
          tlPointView.x,
          tlPointView.y,
          tl.x - tlPointView.x,
          brPointView.y - tlPointView.y
        );
      }
      if (tlPointView.y < tl.y) {
        this._context.clearRect(
          tlPointView.x,
          tlPointView.y,
          brPointView.x - tlPointView.x,
          tl.y - tlPointView.y
        );
      }
      if (brPointView.x > br.x) {
        this._context.clearRect(
          br.x,
          tlPointView.y,
          brPointView.x - br.x,
          brPointView.y - tlPointView.y
        );
      }
      if (brPointView.y > br.y) {
        this._context.clearRect(
          tlPointView.x,
          br.y,
          brPointView.x - tlPointView.x,
          brPointView.y - br.y
        );
      }

      // 此时会重新渲染这个范围的底图，需要加载这个范围内的瓦片
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
          imgLoadPromises.push(this.drawTile(this._currentTileSet.tileZ, x, y));
        }
      }

      await Promise.all(imgLoadPromises);
    } else {
      // 此时不渲染任何瓦片
      this._context.clearRect(
        tlPointView.x,
        tlPointView.y,
        brPointView.x - tlPointView.x,
        brPointView.y - tlPointView.y
      );
      return;
    }
  }

  private async drawTile(z: number, x: number, y: number) {
    const imgUrl = this.options.tileUrlPattern
      .replace('{z}', z.toString())
      .replace('{x}', x.toString())
      .replace('{y}', y.toString());
    let img: HTMLImageElement;
    if (this.options.loadTileImageHook !== undefined) {
      img = await this.options.loadTileImageHook(imgUrl);
    } else {
      img = await loadImage(imgUrl);
    }
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

    const tlPointView = invertTransformMatrix.transformPoint({ x: 0, y: 0 });
    const brPointView = invertTransformMatrix.transformPoint({
      x: this.viewportWidth,
      y: this.viewportHeight
    });

    // 返回左上和右下两个点坐标
    return { tlPointView, brPointView };
  }
}
