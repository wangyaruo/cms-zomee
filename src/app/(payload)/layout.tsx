import type { ReactNode } from 'react'
import configPromise from '@payload-config'
import '@payloadcms/next/css'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import type { ServerFunctionClient } from 'payload'
import { importMap } from './admin/importMap'

const serverFunction: ServerFunctionClient = async (args) => {
  'use server'
  return handleServerFunctions({ ...args, config: configPromise, importMap })
}

export default function PayloadLayout({ children }: { children: ReactNode }) {
  return <RootLayout config={configPromise} importMap={importMap} serverFunction={serverFunction}>{children}</RootLayout>
}
