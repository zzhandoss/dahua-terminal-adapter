declare module "better-sqlite3" {
  type RunResult = {
    changes: number;
  };

  class Statement<Result = unknown> {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): Result | undefined;
    all(...params: unknown[]): Result[];
  }

  class Database {
    constructor(path: string);
    pragma(statement: string): unknown;
    exec(statement: string): void;
    prepare<Result = unknown>(statement: string): Statement<Result>;
    transaction<T extends (...args: never[]) => unknown>(fn: T): T;
    close(): void;
  }

  export = Database;
}
