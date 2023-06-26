/**
 * 内存数据缓存队列
 */

export class CacheQueue<D = string> {
  private _store: Record<string, D> = {};
  private _keys: string[] = [];

  constructor(private readonly maxCount: number = 200) {}

  setData(key: string, data: D) {
    if (this._store[key] === undefined) {
      this._keys.push(key);
    } else {
      console.warn(
        `The key[${key}]'s data already exists, will be replaced for a new one!`
      );
    }
    this._store[key] = data;
    // check store count if bigger than maxCount
    while (this._keys.length > this.maxCount) {
      const deleteKey = this._keys.shift();
      if (deleteKey !== undefined) {
        delete this._store[deleteKey];
      }
    }
  }

  getData(key: string) {
    const val = this._store[key];
    if (val === undefined) {
      return;
    } else {
      return val;
    }
  }
}
