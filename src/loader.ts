import { loadImage } from './utils/img';
import { fabric } from 'fabric';

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
  tileUrlPattern?: string;
  // 生成瓦片url的钩子方法,tileUrlPattern和getTileUrlHook必须至少设置一个
  getTileUrlHook?: (z: number, x: number, y: number) => string | string[];
  // 栅格瓦片数据集
  tileSet: ITile[];
  // 渲染目标画布
  canvasElement: HTMLCanvasElement | fabric.StaticCanvas;
  // 加载栅格瓦片的钩子，如果设置了，会取代默认的加载图片的方法
  loadTileImageHook?: LoadTileImage;
  // 副瓦片渲染的透明度，默认0.5
  assistTileOpacity?: number;
}

export class TilesLoader {
  private _canvas: HTMLCanvasElement;
  private _cacheCanvas: HTMLCanvasElement;
  private _context: CanvasRenderingContext2D;
  private _cacheContext: CanvasRenderingContext2D;
  private _tileSet: ITile[];
  // 当前使用的瓦片数据集
  private _currentTileSet?: ITile;

  // 当前瓦片数据集，x和y两个方向上的最大瓦片数量
  private _xTilesCount = 0;
  private _yTilesCount = 0;
  // 当前瓦片数据集，拼接成的底图的宽度和高度
  private _fullImageWidth = 0;
  private _fullImageHeight = 0;

  // 当前瓦片底图的缩放级别，默认是1，表示无缩放变换
  private _zoom = 1;

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
    // 设置一些选项的默认值
    if (options.assistTileOpacity === undefined) {
      options.assistTileOpacity = 0.5;
    }
    this._canvas = options.canvasElement as HTMLCanvasElement;
    this._tileSet = [...this.options.tileSet].sort(
      (a, b) => a.unitsPerPixel - b.unitsPerPixel
    );
    this._context = this._canvas.getContext('2d')!;

    // 为解决绘制闪屏，创建离屏canvas
    this._cacheCanvas = document.createElement('canvas');
    this._cacheCanvas.width = this.viewportWidth;
    this._cacheCanvas.height = this.viewportHeight;
    this._cacheContext = this._cacheCanvas.getContext('2d')!;
  }

  setZoom(zoom: number) {
    this._zoom = zoom;
    // 判断是否使用的瓦片数据集发生了变化
    const tileSetIsChanged = this.checkTileSet(zoom);
    if (tileSetIsChanged) {
      this.onTileSetChanged();
    }
  }

  setTranslation(x: number, y: number) {
    const mtx = this._cacheContext.getTransform();
    mtx.e = x;
    mtx.f = y;
    this._cacheContext.setTransform(mtx);
  }

  // 根据当前zoom确定所要使用的瓦片数据集
  private checkTileSet(zoom: number) {
    const currentUnitsPerPixel = 1 / zoom;
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

    // 如果经过判断，没有找到合适的新瓦片数据集，那么仍然沿用之前的数据集
    if (!newTileSet) {
      newTileSet = this._currentTileSet;
      tileSetIsChanged = false;
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

      // console.log('switch to new tileSet, tileZ: ', this._currentTileSet.tileZ);
    } else {
      this._xTilesCount = 0;
      this._yTilesCount = 0;

      this._fullImageWidth = 0;
      this._fullImageHeight = 0;
    }
  }

  async render() {
    // 获取当前设置的缩放级别
    const zoom = this._zoom;
    if (!!this._currentTileSet) {
      // 将画布使用单位像素比做一下校准变换
      const mtx = this._cacheContext.getTransform();
      mtx.a = mtx.d = this._currentTileSet.unitsPerPixel * this._zoom;
      this._cacheContext.setTransform(mtx);
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
    // 找到当前可视范围的区域
    const { tlPointView, brPointView } = this.getViewportArea();
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
        this._cacheContext.clearRect(
          tlPointView.x,
          tlPointView.y,
          tl.x - tlPointView.x,
          brPointView.y - tlPointView.y
        );
      }
      if (tlPointView.y < tl.y) {
        this._cacheContext.clearRect(
          tlPointView.x,
          tlPointView.y,
          brPointView.x - tlPointView.x,
          tl.y - tlPointView.y
        );
      }
      if (brPointView.x > br.x - this.options.tileWidth) {
        this._cacheContext.clearRect(
          br.x - this.options.tileWidth,
          tlPointView.y,
          brPointView.x - br.x + this.options.tileWidth,
          brPointView.y - tlPointView.y
        );
      }
      if (brPointView.y > br.y - this.options.tileHeight) {
        this._cacheContext.clearRect(
          tlPointView.x,
          br.y - this.options.tileHeight,
          brPointView.x - tlPointView.x,
          brPointView.y - br.y + this.options.tileHeight
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
      this._cacheContext.clearRect(
        tlPointView.x,
        tlPointView.y,
        brPointView.x - tlPointView.x,
        brPointView.y - tlPointView.y
      );
    }

    // 将离屏canvas渲染到展示的canvas上
    this._context.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    this._context.drawImage(this._cacheCanvas, 0, 0);
  }

  private async drawTile(z: number, x: number, y: number) {
    let imgUrl: string;
    if (!!this.options.getTileUrlHook) {
      const tileUrls = this.options.getTileUrlHook(z, x, y);
      if (Array.isArray(tileUrls)) {
        // TODO: 普通canvas瓦片加载器暂不支持多瓦片叠加
        imgUrl = tileUrls[0];
      } else {
        imgUrl = tileUrls;
      }
    } else if (!!this.options.tileUrlPattern) {
      imgUrl = this.options.tileUrlPattern
        .replace('{z}', z.toString())
        .replace('{x}', x.toString())
        .replace('{y}', y.toString());
    } else {
      throw new Error(
        `Failed to draw tile: getTileUrlHook or tileUrlPattern must be set one at least!`
      );
    }
    if (!imgUrl) {
      throw new Error(`Failed to draw tile: tile img url is empty!`);
    }
    const img = (await loadImage([imgUrl], this.options.loadTileImageHook))[0];
    this._cacheContext.drawImage(
      img,
      x * this.options.tileWidth,
      y * this.options.tileHeight
    );
  }

  private getViewportArea() {
    // 获取当前画布的变换矩阵
    const transformMatrix = this._cacheContext.getTransform();
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
