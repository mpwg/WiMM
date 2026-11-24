export type ReceiptMetadata = {
  id: string
  bookingId: string
  originalName: string
  mediaType: 'application/pdf' | 'image/jpeg' | 'image/png'
  size: number
}
