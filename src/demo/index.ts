import { TilesLoader } from '../index';
import { loadImage } from '../utils/img';
import bgImgUrl from './bg.jpg';

(async function () {
  const canvasElement = document.getElementById(
    'demoCanvas'
  ) as HTMLCanvasElement;

  const context = canvasElement.getContext('2d')!;

  let unitsPerPixel = 4;
  const mtx: [number, number, number, number, number, number] = [
    1 / unitsPerPixel,
    0,
    0,
    1 / unitsPerPixel,
    0,
    0
  ];

  context.setTransform(...mtx);

  const loader = new TilesLoader({
    tileWidth: 256,
    tileHeight: 256,
    originalImageWidth: 8814,
    originalImageHeight: 9384,
    tileUrlPattern: './src/demo/tiles/{z}/{x}/{y}.png',
    tileSet: [
      { unitsPerPixel: 1, tileZ: 6 },
      { unitsPerPixel: 2, tileZ: 5 },
      { unitsPerPixel: 4, tileZ: 4 },
      { unitsPerPixel: 8, tileZ: 3 },
      { unitsPerPixel: 16, tileZ: 2 },
      { unitsPerPixel: 32, tileZ: 1 },
      { unitsPerPixel: 64, tileZ: 0 }
    ],
    canvasElement,
    async loadTileImageHook(imgUrl: string) {
      return await loadImage(imgUrl);
    }
  });

  loader.render();
  const lastZoom = 1 / unitsPerPixel;

  // @ts-ignore
  window.render = (unitsPerPixel: number) => {
    const mtx: [number, number, number, number, number, number] = [
      1 / unitsPerPixel,
      0,
      0,
      1 / unitsPerPixel,
      0,
      0
    ];

    context.setTransform(...mtx);
    loader.render();
  };

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') {
      unitsPerPixel += 0.1;
    } else if (e.key === 'ArrowDown') {
      unitsPerPixel -= 0.1;
    }
    console.log('@@@ unitsPerPixel:', unitsPerPixel);
    // @ts-ignore
    window.render(unitsPerPixel);
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
