export type UploadUrl = {
  url: string
  headers?: Record<string, string>
}

export interface ObjectStore {
  putText(key: string, text: string, contentType?: string): Promise<void>
  putBytes(key: string, bytes: Uint8Array, contentType?: string): Promise<void>
  getText(key: string): Promise<string>
  getBytes(key: string): Promise<Buffer>
  getObjectSize(key: string): Promise<number>
  deleteObject(key: string): Promise<void>
  listKeys(prefix: string): Promise<string[]>
  createUploadUrl?(key: string, input: { contentType?: string; expiresInSeconds: number; maxBytes?: number }): Promise<UploadUrl>
}
