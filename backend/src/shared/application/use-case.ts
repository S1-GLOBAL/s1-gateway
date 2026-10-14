/** One thing the application does, independent of how it is invoked. */
export interface UseCase<I, O> {
  execute(input: I): Promise<O>;
}
