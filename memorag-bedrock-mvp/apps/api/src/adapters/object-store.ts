export interface ObjectStore {
  putText(key: string, text: string, contentType?: string): Promise<void>
  getText(key: string): Promise<string>
  deleteObject(key: string): Promise<void>
  listKeys(prefix: string): Promise<string[]>
}
