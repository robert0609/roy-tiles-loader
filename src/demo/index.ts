import {
  TilesLoader,
  getTilesConfig,
  getTilesLoaderByXmlConfig
} from '../index';
import { loadImage } from '../utils/img';
import bgImgUrl from './bg.jpg';

(async function () {
  const canvasElement = document.getElementById(
    'demoCanvas'
  ) as HTMLCanvasElement;

  const loader = await getTilesLoaderByXmlConfig({
    tilesConfigUrl: 'src/demo/tiles/tilemapresource.xml',
    tileUrlPattern: './src/demo/tiles/{z}/{x}/{y}.png',
    canvasElement,
    async loadTileImageHook(imgUrl: string) {
      return await loadImage(imgUrl);
    }
  });

  let zoom = 1 / 8;
  loader.setZoom(zoom);
  loader.render();

  // @ts-ignore
  window.render = (zoom: number) => {
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
    loader.setZoom(zoom);
    loader.render();
  });
})();

// (async () => {
//   const bgImg = await loadImage(bgImgUrl);

//   const canvasElement = document.getElementById(
//     'demoCanvas'
//   ) as HTMLCanvasElement;

//   const context = canvasElement.getContext('2d')!;

//   const unitsPerPixel = 4;
//   const mtx: [number, number, number, number, number, number] = [
//     1 / unitsPerPixel,
//     0,
//     0,
//     1 / unitsPerPixel,
//     0,
//     0
//   ];

//   context.setTransform(...mtx);

//   context.drawImage(bgImg, 0, 0);

//   // context.fillStyle = 'green';
//   // context.fillRect(10, 10, 150, 100);

//   // const targetPoint1 = invertMatrix1.transformPoint({ x: 700, y: 500 });

//   // context.beginPath();
//   // context.arc(targetPoint1.x, targetPoint1.y, 2, 0, 2 * Math.PI);
//   // context.fill();

//   // @ts-ignore
//   window.render = (unitsPerPixel: number) => {
//     const mtx: [number, number, number, number, number, number] = [
//       1 / unitsPerPixel,
//       0,
//       0,
//       1 / unitsPerPixel,
//       0,
//       0
//     ];

//     context.setTransform(...mtx);
//     // context.drawImage(bgImg, 0, 0);
//   };
// })();
