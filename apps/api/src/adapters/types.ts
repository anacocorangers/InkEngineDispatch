import type { DispatchItem, SourceId } from '@inkengine/contracts'

export type AdapterContext = {
  nowIso: string
}

export interface SourceAdapter {
  id: SourceId
  fetchLatest(context: AdapterContext): Promise<DispatchItem[]>
}
