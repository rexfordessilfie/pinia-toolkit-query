export type QueryResult<EndpointResponse = unknown> = {
  data: EndpointResponse | undefined
  error: unknown
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  isInitialized: boolean
}

export interface QueryStoreState<EndpointResponse = unknown> {
  [key: string]: QueryResult<EndpointResponse> | undefined
}
export type QueryReturnValue<T = unknown, E = unknown, M = unknown> =
  | {
      error: E
      data?: undefined
      meta?: M
    }
  | {
      error?: undefined
      data: T
      meta?: M
    }

export type BaseQueryFn<
  Args = QueryFnOptions,
  Result = unknown,
  Error = unknown,
  Meta = Record<string, unknown>
> = (args: Args) => Promise<QueryReturnValue<Result, Error, Meta>>

export type DefineEndpointStoreOpts<Args = unknown, Response = unknown> = {
  url: string
  method: string
  onQueryDone?: (args?: Args, response?: Response) => void | Promise<void>
}

export type QueryType = 'mutation' | 'query'

export type QueryFnOptions<Arg = unknown> = {
  url: string
  method: string
  body?: Arg
  headers?: Record<string, any>
}
