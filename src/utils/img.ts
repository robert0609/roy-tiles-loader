import { CacheQueue } from './cache';

async function loadImageFromCloud(url: string) {
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

// 本地内存中的已加载完成的图片缓存队列
const imageCacheQueue = new CacheQueue<HTMLImageElement>();

// 从云端加载图片的任务缓存队列
const imageLoadFromCloudPromiseMap: Record<
  string,
  Promise<HTMLImageElement>
> = {};

export async function loadImage(...urls: string[]) {
  const loadResultPromises: Promise<HTMLImageElement>[] = [];

  for (const url of urls) {
    const localImage = imageCacheQueue.getData(url);
    if (!localImage) {
      if (!imageLoadFromCloudPromiseMap[url]) {
        // 建立从云端加载图片的任务
        const loadTask = (async () => {
          const img = await loadImageFromCloud(url);
          imageCacheQueue.setData(url, img);
          // 执行完之后，将自己从队列中移除
          delete imageLoadFromCloudPromiseMap[url];
          return img;
        })();
        imageLoadFromCloudPromiseMap[url] = loadTask;
        loadResultPromises.push(loadTask);
      } else {
        // 有别的逻辑已经插入了加载任务，直接取用
        loadResultPromises.push(imageLoadFromCloudPromiseMap[url]);
      }
    } else {
      loadResultPromises.push(Promise.resolve(localImage));
    }
  }

  const result = await Promise.all(loadResultPromises);
  return result;
}
