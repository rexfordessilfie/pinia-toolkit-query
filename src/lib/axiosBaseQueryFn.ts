import type { AxiosInstance } from 'axios'
import type { BaseQueryFn, QueryFnOptions } from './defineApi.types'
import * as axios from 'axios'

export type ApiErrorDetails = {
  message: string
  code: string
}

export const parseApiError = (error: Error): ApiErrorDetails => {
  let message = 'An unknown error occurred!'
  let code = 'unknown'

  const possiblyAxiosError = error as axios.AxiosError
  if (possiblyAxiosError.isAxiosError) {
    const errorData = possiblyAxiosError.response?.data as ApiErrorDetails

    if (typeof errorData === 'string') {
      message = errorData
    }

    if (errorData?.code) {
      code = errorData.code
    }

    if (errorData?.message) {
      message = errorData.message
    }
  } else {
    message = error.message
  }

  return {
    message,
    code
  }
}

const shouldUseParams = (method: string) => ['get', 'delete'].includes(method.toLocaleLowerCase())
const shouldUseBody = (method: string) => ['post', 'put'].includes(method.toLocaleLowerCase())

export const axiosBaseQuery =
  (client: AxiosInstance): BaseQueryFn =>
  async (options: QueryFnOptions) => {
    console.log('axiosBaseQuery', options)
    try {
      const { method, body, url } = options

      const response = await client({
        url: url,
        method,
        params: body && shouldUseParams(method) ? body : undefined,
        data: body && shouldUseBody(method) ? body : undefined,
        headers: options.headers
      })

      return { data: response.data }
    } catch (e) {
      return { error: parseApiError(e as Error) }
    }
  }
