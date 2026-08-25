declare module 'svgmap' {
  interface SvgMapOptions {
    targetElementID: string
    data: {
      data: Record<string, { name: string; format?: string; thousandSeparator?: string }>
      applyData: string
      values: Record<string, Record<string, number>>
    }
    colorMax?: string
    colorMin?: string
    colorNoData?: string
    flagType?: 'image' | 'emoji'
    showZoomReset?: boolean
    zoomButtonsPosition?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
    minZoom?: number
    maxZoom?: number
    initialZoom?: number
  }

  export default class svgMap {
    constructor(options: SvgMapOptions)
  }
}

declare module 'svgmap/style'
