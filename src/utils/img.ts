export async function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const loadImg = document.createElement('img');
    loadImg.setAttribute('crossOrigin', 'Anonymous');
    loadImg.src = url;
    loadImg.onload = () => {
      resolve(loadImg);
    };
    loadImg.onerror = (evt) => {
      reject(evt);
    };
  });
}
