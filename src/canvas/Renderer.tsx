'use client'

import { Render } from '@measured/puck'
import { canvasConfig } from './config'
import './canvas.css'

export function CanvasRenderer({ data, device = 'desktop' }: { data: any; device?: 'desktop' | 'mobile' }) {
  return <div className={device === 'mobile' ? 'canvas-device' : ''}><CanvasShellContent data={data} /></div>
}

function CanvasShellContent({ data }: { data: any }) {
  return <main className="canvas-page"><Render config={canvasConfig} data={data} /></main>
}
