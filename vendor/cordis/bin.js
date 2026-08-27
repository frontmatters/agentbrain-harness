#!/usr/bin/env node

import { Context } from '@agentbrain-harness/cordis'
import { pathToFileURL } from 'node:url'
import Loader from '@agentbrain-harness/cordis-plugin-loader'

const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'

await ctx.plugin(Loader)
await ctx.loader.create({
  name: '@agentbrain-harness/cordis-plugin-include',
  config: {
    path: './cordis.yml',
  },
})
