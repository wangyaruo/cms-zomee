import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const buildRoot = process.env.CMS_BUILD_ROOT || process.cwd()

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: buildRoot },
  outputFileTracingRoot: buildRoot,
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
