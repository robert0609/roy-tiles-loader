import { ITile, ITilesLoaderOption } from './loader';
import { loadImage } from './utils/img';
import { fabric } from 'fabric';

export class FabricTilesLoader {
  private _canvas: fabric.StaticCanvas;
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
  // 当前已经渲染到fabric画布上的瓦片图片实例
  private _currentRenderedImgs: fabric.Image[] = [];

  /**
   * 主瓦片是否显示，默认true
   */
  mainVisible = true;

  /**
   * 可视范围宽度
   */
  get viewportWidth() {
    return this._canvas.getWidth();
  }

  /**
   * 可视范围高度
   */
  get viewportHeight() {
    return this._canvas.getHeight();
  }

  constructor(private options: ITilesLoaderOption) {
    // 设置一些选项的默认值
    if (options.assistTileOpacity === undefined) {
      options.assistTileOpacity = 0.5;
    }
    this._canvas = options.canvasElement as fabric.StaticCanvas;
    this._tileSet = [...this.options.tileSet].sort(
      (a, b) => a.unitsPerPixel - b.unitsPerPixel
    );
  }

  setZoom(zoom: number) {
    this._zoom = zoom;
    // 判断是否使用的瓦片数据集发生了变化
    const tileSetIsChanged = this.checkTileSet(zoom);
    if (tileSetIsChanged) {
      this.onTileSetChanged();
    }
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

      this._fullImageWidth =
        this.options.tileWidth *
        this._xTilesCount *
        this._currentTileSet.unitsPerPixel;
      this._fullImageHeight =
        this.options.tileHeight *
        this._yTilesCount *
        this._currentTileSet.unitsPerPixel;

      // console.log('switch to new tileSet, tileZ: ', this._currentTileSet.tileZ, this._xTilesCount, this._yTilesCount, this._fullImageWidth, this._fullImageHeight);
    } else {
      this._xTilesCount = 0;
      this._yTilesCount = 0;

      this._fullImageWidth = 0;
      this._fullImageHeight = 0;
    }
  }

  async render() {
    // 如果没有找到当前缩放级别所对应的瓦片数量，则该情况是没有生成对应这一级别的栅格瓦片，就不渲染
    if (
      this._currentTileSet === undefined ||
      this._xTilesCount === 0 ||
      this._yTilesCount === 0
    ) {
      console.warn(`The tiles for zoom[${this._zoom}] are not found!`);
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
      const calibTileWidth =
        this.options.tileWidth * this._currentTileSet.unitsPerPixel;
      const calibTileHeight =
        this.options.tileHeight * this._currentTileSet.unitsPerPixel;
      // 此时会重新渲染这个范围的底图，需要加载这个范围内的瓦片
      const xStart = Math.floor(tl.x / calibTileWidth);
      let xEnd = Math.floor(br.x / calibTileWidth);
      if (br.x % calibTileWidth === 0) {
        xEnd -= 1;
      }
      const yStart = Math.floor(tl.y / calibTileHeight);
      let yEnd = Math.floor(br.y / calibTileHeight);
      if (br.y % calibTileHeight === 0) {
        yEnd -= 1;
      }

      // 根据找到的x和y方向上的索引范围，找到所需要加载的瓦片地址
      const imgLoadPromises: Promise<fabric.Image>[] = [];
      const assistImgLoadPromises: Promise<fabric.Image[]>[] = [];
      for (let x = xStart; x <= xEnd; ++x) {
        for (let y = yStart; y <= yEnd; ++y) {
          if (this.mainVisible === true) {
            imgLoadPromises.push(
              this.drawMainTile(this._currentTileSet.tileZ, x, y)
            );
          }
          assistImgLoadPromises.push(
            this.drawAssistTile(this._currentTileSet.tileZ, x, y)
          );
        }
      }

      if (imgLoadPromises.length > 0) {
        // 只要主瓦片加载完成之后，就进行刷新渲染，无需等副瓦片加载完
        const mainImgs = await Promise.all(imgLoadPromises);
        // 先清除上一次渲染的所有瓦片
        this.clear();
        this._canvas.add(...mainImgs);
        // 将加载的所有瓦片都缓存一下，以备后面清除
        this._currentRenderedImgs.push(...mainImgs);

        // 等待所有副瓦片加载完
        const assistImgs = await Promise.all(assistImgLoadPromises);
        for (const gridImgs of assistImgs) {
          this._canvas.add(...gridImgs);
          // 将加载的所有瓦片都缓存一下，以备后面清除
          this._currentRenderedImgs.push(...gridImgs);
        }
      } else {
        // 等待所有副瓦片加载完
        const assistImgs = await Promise.all(assistImgLoadPromises);
        // 清除上一次渲染的所有瓦片
        this.clear();
        for (const gridImgs of assistImgs) {
          this._canvas.add(...gridImgs);
          // 将加载的所有瓦片都缓存一下，以备后面清除
          this._currentRenderedImgs.push(...gridImgs);
        }
      }
    } else {
      // 此时不渲染任何瓦片
      this.clear();
    }
  }

  private async drawMainTile(z: number, x: number, y: number) {
    let mainImgUrl: string | undefined;
    if (!!this.options.getTileUrlHook) {
      const tileUrls = this.options.getTileUrlHook(z, x, y);
      if (Array.isArray(tileUrls)) {
        if (tileUrls.length > 0) {
          mainImgUrl = tileUrls[0];
        }
      } else {
        mainImgUrl = tileUrls;
      }
    } else if (!!this.options.tileUrlPattern) {
      mainImgUrl = this.options.tileUrlPattern
        .replace('{z}', z.toString())
        .replace('{x}', x.toString())
        .replace('{y}', y.toString());
    } else {
      throw new Error(
        `Failed to draw tile: getTileUrlHook or tileUrlPattern must be set one at least!`
      );
    }
    if (!mainImgUrl) {
      throw new Error(`Failed to draw tile: tile img url is empty!`);
    }
    const img = (
      await loadImage([mainImgUrl], this.options.loadTileImageHook)
    )[0];
    const calibTileWidth =
      this.options.tileWidth * this._currentTileSet!.unitsPerPixel;
    const calibTileHeight =
      this.options.tileHeight * this._currentTileSet!.unitsPerPixel;
    return new fabric.Image(img, {
      selectable: false,
      left: x * calibTileWidth,
      top: y * calibTileHeight,
      scaleX: this._currentTileSet!.unitsPerPixel,
      scaleY: this._currentTileSet!.unitsPerPixel
    });
  }

  private async drawAssistTile(z: number, x: number, y: number) {
    let assistImgUrls: string[] = [];
    if (!!this.options.getTileUrlHook) {
      const tileUrls = this.options.getTileUrlHook(z, x, y);
      if (Array.isArray(tileUrls)) {
        if (tileUrls.length > 1) {
          assistImgUrls = tileUrls.slice(1);
        }
      }
    } else {
      throw new Error(
        `Failed to draw assist tile: getTileUrlHook must be set!`
      );
    }
    if (assistImgUrls.length === 0) {
      return [];
    }
    const assistImgs = await loadImage(
      assistImgUrls,
      this.options.loadTileImageHook
    );
    const calibTileWidth =
      this.options.tileWidth * this._currentTileSet!.unitsPerPixel;
    const calibTileHeight =
      this.options.tileHeight * this._currentTileSet!.unitsPerPixel;
    return assistImgs.map(
      (img) =>
        new fabric.Image(img, {
          selectable: false,
          left: x * calibTileWidth,
          top: y * calibTileHeight,
          scaleX: this._currentTileSet!.unitsPerPixel,
          scaleY: this._currentTileSet!.unitsPerPixel,
          opacity: this.options.assistTileOpacity
        })
    );
  }

  private getViewportArea() {
    const coords = this._canvas.vptCoords!;
    // 返回左上和右下两个点坐标
    return { tlPointView: coords.tl, brPointView: coords.br };
  }

  clear() {
    this.mainVisible = false;
    this._canvas.remove(...this._currentRenderedImgs);
    this._currentRenderedImgs = [];
  }
}
