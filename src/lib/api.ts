import * as axios from 'axios'
import { defineApi } from './defineApi'
import { axiosBaseQuery } from './axiosBaseQueryFn'

const client = axios.default.create({
  headers: {
    'Content-Type': 'application/json'
  }
})

export const api = defineApi({
  name: 'pokeApi',
  baseQueryFn: axiosBaseQuery(client),
  endpoints: (builder) => ({
    getPokemon: builder.query<{ name: string }, unknown>({
      query: (args) => ({
        url: `https://pokeapi.co/api/v2/pokemon/${args.name}`,
        method: 'get'
      })
    }),
    getAllPokemon: builder.query<unknown, unknown>({
      query: () => ({
        url: `https://pokeapi.co/api/v2/pokemon`,
        method: 'get'
      })
    }),
    addPost: builder.mutation<{ title: string }, { id: number }>({
      query: (args) => ({
        url: `https://jsonplaceholder.typicode.com/posts`,
        method: 'post',
        body: args
      })
    }),
    getPosts: builder.query<unknown, unknown>({
      query: () => ({
        url: `https://jsonplaceholder.typicode.com/posts`,
        method: 'get'
      })
    }),
    getPost: builder.query<{ id: number }, unknown>({
      query: (args) => ({
        url: `https://jsonplaceholder.typicode.com/posts/${args.id}`,
        method: 'get'
      })
    })
  })
})
