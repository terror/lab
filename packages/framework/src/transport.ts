export interface Transport<Input, Output> {
  send(input: Input): Promise<Output>;

  receive(input: Input): Promise<Output>;
}
