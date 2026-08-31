// Read a File as a base64 string (without the data: URL prefix) — used
// wherever a file gets attached to a JSON request body (job applications,
// chat attachments).
export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
