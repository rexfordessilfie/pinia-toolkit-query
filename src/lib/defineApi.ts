/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { defineStore } from 'pinia'
import type {
  BaseQueryFn,
  QueryFnOptions as BaseQueryFnOptions,
  QueryResult,
  QueryStoreState,
  QueryType
} from './defineApi.types'
import { axiosBaseQuery } from './axiosBaseQueryFn'
import * as axios from 'axios'
import { computed, ref, unref, watch } from 'vue'

type EndpointName = string | number | symbol

const getCacheKey = (endpoint: EndpointName, args: any = {}) => {
  return `${endpoint.toString()}(${JSON.stringify(args)})`
}

const defaultQueryResult: Readonly<QueryResult> = Object.freeze({
  isLoading: false,
  isSuccess: false,
  isError: false,
  data: undefined,
  error: undefined,
  isInitialized: false
})

const resultType = Symbol('resultType')

type EndpointDefinition<EndpointArg, EndpointResponse, Type extends QueryType> = {
  query: (args: EndpointArg) => BaseQueryFnOptions
  type: Type
  onQueryStarted?: (args: EndpointArg, queryFulfilled: Promise<EndpointResponse>) => Promise<void>
}

type EndpointDefinitions = (builder: {
  query: <EndpointArg, EndpointResponse>(
    opts: Omit<EndpointDefinition<EndpointArg, EndpointResponse, any>, 'type'>
  ) => typeof opts & {
    type: 'query'
    [resultType]: EndpointResponse
  }
  mutation: <EndpointArg, EndpointResponse>(
    opts: Omit<EndpointDefinition<EndpointArg, EndpointResponse, any>, 'type'>
  ) => typeof opts & {
    type: 'mutation'
    [resultType]: EndpointResponse
  }
}) => Record<
  string,
  EndpointDefinition<any, any, any> & {
    [resultType]: any
  }
>

type ApiStore<
  TEndpointDefinitions extends EndpointDefinitions,
  TEndpointDefinitionReturn extends
    ReturnType<TEndpointDefinitions> = ReturnType<TEndpointDefinitions>
> = {
  useStore: () => QueryStoreState
  endpoints: {
    [Endpoint in keyof TEndpointDefinitionReturn]: TEndpointDefinitionReturn[Endpoint]['type'] extends 'query'
      ? {
          useQuery: (
            args: Parameters<TEndpointDefinitionReturn[Endpoint]['query']>[0]
          ) => QueryResult<TEndpointDefinitionReturn[Endpoint][typeof resultType]>
        }
      : {
          useMutation: () => [
            (
              args: Parameters<TEndpointDefinitionReturn[Endpoint]['query']>[0],
              opts?: { forceRefetch?: boolean }
            ) => void,
            QueryResult<TEndpointDefinitionReturn[Endpoint][typeof resultType]>
          ]
        }
  }
}

export const defineApi = <
  TEndpointDefinitions extends EndpointDefinitions,
  TBaseQueryFn extends BaseQueryFn = BaseQueryFn
>(options: {
  name: string
  baseQueryFn: TBaseQueryFn
  endpoints: TEndpointDefinitions
}): ApiStore<TEndpointDefinitions> => {
  const query = <ApiArg, ApiResponse>(opts: {
    query: (args: ApiArg) => BaseQueryFnOptions
    onQueryStarted?: (args: ApiArg, queryFulfilled: Promise<ApiResponse>) => Promise<void>
  }) => {
    return {
      [resultType]: undefined as unknown as ApiResponse,
      query: opts.query,
      type: 'query' as const,
      onQueryStarted: opts.onQueryStarted
    }
  }

  const mutation = <ApiArg, ApiResponse>(opts: {
    query: (args: ApiArg) => BaseQueryFnOptions
    onQueryStarted?: (args: ApiArg, queryFulfilled: Promise<ApiResponse>) => Promise<void>
  }) => {
    return {
      [resultType]: undefined as unknown as ApiResponse,
      query: opts.query,
      type: 'mutation' as const,
      onQueryStarted: opts.onQueryStarted
    }
  }

  const endpointDefinitions = options.endpoints({
    query: query,
    mutation: mutation
  })

  const useApiStore = defineStore({
    id: options.name,
    state: (): QueryStoreState => ({}),
    getters: {
      result: (state) => (endpoint: string, args?: unknown) => {
        const key = getCacheKey(endpoint, args)
        return state[key] ?? defaultQueryResult
      }
    },
    actions: {
      async initiate(
        endpoint: string,
        args: unknown,
        opts: {
          throwable?: boolean
          forceRefetch?: boolean
        },
        requestId = ''
      ) {
        const endpointDefinition = endpointDefinitions[endpoint as string]
        const cacheKey =
          endpointDefinition.type === 'mutation'
            ? getCacheKey(endpoint, requestId) // Mutations should not be cached by args
            : getCacheKey(endpoint, args)

        const shouldFetch =
          !this[cacheKey]?.isInitialized || opts.forceRefetch || this[cacheKey]?.isError

        if (!shouldFetch) {
          return
        }

        this[cacheKey] = {
          ...defaultQueryResult,
          isLoading: true
        }

        try {
          const queryArgs = endpointDefinition.query(args)
          console.log('[Query Store] Requesting...')
          const queryFulfilled = options.baseQueryFn(queryArgs)
          endpointDefinition.onQueryStarted?.(args, queryFulfilled)

          const result = await queryFulfilled
          console.log({ result })

          this[cacheKey] = {
            ...this[cacheKey],
            isSuccess: result.data !== undefined,
            isError: result.error !== undefined,
            isLoading: false,
            data: result.data,
            error: result.error,
            isInitialized: true
          }

          if (result?.error) {
            if (opts?.throwable) {
              throw result.error
            }
          }

          return this[cacheKey]
        } catch (error) {
          this[cacheKey] = {
            ...this[cacheKey],
            isSuccess: false,
            isLoading: false,
            isError: true,
            error: error as unknown,
            data: undefined,
            isInitialized: true
          }

          if (opts?.throwable) {
            throw error
          }
        }
      }
    }
  })

  const value: ApiStore<TEndpointDefinitions> = Object.keys(endpointDefinitions).reduce(
    (acc, endpoint) => {
      const endpointDefinition = endpointDefinitions[endpoint]
      if (endpointDefinition.type === 'query') {
        acc.endpoints = acc.endpoints ?? {}

        acc.endpoints[endpoint] = {
          useQuery: (args: object, opts: { forceRefetch?: boolean } = {}) => {
            const store = useApiStore()

            watch(
              args,
              (newArgs) => {
                store.initiate(endpoint, newArgs, {
                  forceRefetch: opts.forceRefetch
                })
              },
              {
                immediate: true
              }
            )

            const result = computed(() => store.result(endpoint, unref(args)))

            const data = computed(() => result.value.data)
            const error = computed(() => result.value.error)
            const isLoading = computed(() => result.value.isLoading)
            const isError = computed(() => result.value.isError)
            const isSuccess = computed(() => result.value.isSuccess)
            const isInitialized = computed(() => result.value.isInitialized)

            const refetch = () => {
              store.initiate(endpoint, args, {
                forceRefetch: true
              })
            }

            return {
              data,
              error,
              isLoading,
              isError,
              isSuccess,
              isInitialized,
              refetch
            }
          }
        }
      } else {
        acc.endpoints[endpoint] = {
          useMutation: () => {
            const requestId = ref('')

            const store = useApiStore()
            const initiate = (args: unknown, opts: { throwable?: boolean } = {}) => {
              requestId.value = Math.random().toString()
              return store.initiate(
                endpoint,
                args,
                {
                  throwable: opts.throwable
                },
                requestId.value
              )
            }

            const result = computed(() => store.result(endpoint, requestId.value))
            const data = computed(() => result.value.data)
            const error = computed(() => result.value.error)
            const isLoading = computed(() => result.value.isLoading)
            const isError = computed(() => result.value.isError)
            const isSuccess = computed(() => result.value.isSuccess)
            const isInitialized = computed(() => result.value.isInitialized)

            return [initiate, { data, error, isLoading, isError, isSuccess, isInitialized }]
          }
        }
      }

      return acc
    },
    {} as any
  )

  return value
}

const client = axios.default.create({
  headers: {
    'Content-Type': 'application/json'
  }
})

export const pokemonApi = defineApi({
  name: 'pokeApi',
  baseQueryFn: axiosBaseQuery(client),
  endpoints: (builder) => ({
    getPokemon: builder.query<{ name: string }, { age: number }>({
      query: (args) => ({
        url: `https://pokeapi.co/api/v2/pokemon/${args.name}`,
        method: 'get'
      })
    }),
    addPost: builder.mutation<{ title: string }, { id: number }>({
      query: (args) => ({
        url: `https://jsonplaceholder.typicode.com/posts`,
        method: 'post',
        body: args
      })
    })
  })
})
