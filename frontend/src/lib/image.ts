// Downscale an image file to a small square-ish JPEG data URL suitable for
// storing inline as a profile photo (~15-40KB).
export function fileToPhotoDataUrl(file: File, maxDim = 384): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas unavailable'))
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

/**
 * Downscale + centre-crop an image file to a fixed wide aspect ratio (3:1),
 * for a profile cover photo. Unlike fileToPhotoDataUrl (which fits the whole
 * image within a square, so a portrait photo would letterbox), a cover photo
 * needs to fill a wide banner exactly — so this crops off whatever doesn't
 * fit that aspect, the way every "cover photo" upload (Facebook, LinkedIn)
 * behaves, rather than distorting or padding the image.
 */
export function fileToBannerDataUrl(file: File, targetW = 1200, targetH = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const targetRatio = targetW / targetH
      const srcRatio = img.width / img.height
      // Crop the source down to the target ratio before scaling, centred on
      // whichever axis has the excess (a portrait photo loses width, a very
      // wide photo loses height) — this is the "cover" behaviour, not "fit".
      let sx = 0
      let sy = 0
      let sw = img.width
      let sh = img.height
      if (srcRatio > targetRatio) {
        sw = img.height * targetRatio
        sx = (img.width - sw) / 2
      } else {
        sh = img.width / targetRatio
        sy = (img.height - sh) / 2
      }
      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas unavailable'))
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}
