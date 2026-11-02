export interface Storage<Connection> {
  readonly connection: Connection;

  start(): Promise<void>;
}
