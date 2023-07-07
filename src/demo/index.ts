import { fabric } from 'fabric';
import {
  TilesLoader,
  getTilesConfig,
  getTilesLoaderByXmlConfig
} from '../index';
import { loadImage } from '../utils/img';

(async function () {
  const canvasElement = document.getElementById(
    'demoCanvas'
  ) as HTMLCanvasElement;
  const fabricCanvas = new fabric.StaticCanvas(canvasElement, {
    width: canvasElement.clientWidth,
    height: canvasElement.clientHeight,
    backgroundColor: '#808080'
  });

  const loader = await getTilesLoaderByXmlConfig({
    tilesConfigUrl: 'src/demo/tiles/tilemapresource.xml',
    tileUrlPattern: './src/demo/tiles/{z}/{x}/{y}.png',
    canvasType: 'fabric',
    canvasElement: fabricCanvas,
    async loadTileImageHook(imgUrl: string) {
      return (await loadImage([imgUrl]))[0];
    }
  });

  let zoom = 1 / 64;
  // fabricCanvas.zoomToPoint({ x: 100, y: 100 }, zoom);
  loader.setZoom(zoom);
  loader.render();

  // @ts-ignore
  window.render = (zoom: number) => {
    // fabricCanvas.zoomToPoint({ x: 100, y: 100 }, zoom);
    loader.setZoom(zoom);
    loader.render();
  };

  const tranX = 0;
  const tranY = 0;

  // document.addEventListener('keyup', (e) => {
  //   if (e.key === 'ArrowUp') {
  //     tranY += 10;
  //   } else if (e.key === 'ArrowDown') {
  //     tranY -= 10;
  //   } else if (e.key === 'ArrowLeft') {
  //     tranX += 10;
  //   } else if (e.key === 'ArrowRight') {
  //     tranX -= 10;
  //   }
  //   loader.setTranslation(tranX, tranY);
  //   loader.render();
  // });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') {
      zoom += 0.001;
    } else if (e.key === 'ArrowDown') {
      zoom -= 0.001;
    }
    // fabricCanvas.zoomToPoint({ x: 100, y: 100 }, zoom);
    loader.setZoom(zoom);
    loader.render();
  });
})();
