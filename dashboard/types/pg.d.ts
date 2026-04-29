declare module "pg" {
  export interface PoolConfig {
    connectionString?: string;
    ssl?: { rejectUnauthorized: boolean };
  }

  export interface QueryResult<Row = unknown> {
    rows: Row[];
    rowCount: number | null;
  }

  export interface PoolClient {
    query<Row = unknown>(text: string, values?: unknown[]): Promise<QueryResult<Row>>;
    release(): void;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<Row = unknown>(text: string, values?: unknown[]): Promise<QueryResult<Row>>;
    connect(): Promise<PoolClient>;
    on(event: "error", listener: (error: Error) => void): this;
  }

  const pg: {
    Pool: typeof Pool;
  };

  export default pg;
}
