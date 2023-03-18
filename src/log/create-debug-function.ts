export interface IDebugFunction {
  (
    level: number,
    ...args: any[]
  ): void;
}

export function createDebugFunction(
  minLevel: number,
): IDebugFunction {
  return (
    level: number,
    ...args: any[]
  ): void => {
    if (level >= minLevel) {
      console.log(...args);
    }
  };
}
