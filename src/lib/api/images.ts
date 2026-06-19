/**
 * Images API — clipboard paste / file upload to /data/pic
 * Endpoints: /api/images/upload, /api/images/:filename
 */
import { ApiError } from './client'

export interface UploadedImage {
  url: string
  filename: string
  path: string
  size: number
  contentType: string
}

export const imagesApi = {
  /** Upload an image (from clipboard paste or file picker). Returns the URL to insert into MD. */
  async upload(file: File | Blob, filenameHint?: string): Promise<UploadedImage> {
    const formData = new FormData()
    const name = filenameHint || (file instanceof File ? file.name : 'pasted.png')
    formData.append('file', file, name)

    const res = await fetch('/api/images/upload', {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      let detail = res.statusText
      try {
        const j = await res.json()
        detail = j.error ?? detail
      } catch {
        /* ignore */
      }
      throw new ApiError(detail, res.status)
    }
    const data = (await res.json()) as {
      url: string
      filename: string
      path: string
      size: number
      content_type: string
    }
    return {
      url: data.url,
      filename: data.filename,
      path: data.path,
      size: data.size,
      contentType: data.content_type,
    }
  },

  /** Delete a stored image by filename. */
  async delete(filename: string): Promise<void> {
    await fetch(`/api/images/${encodeURIComponent(filename)}`, { method: 'DELETE' })
  },
}
