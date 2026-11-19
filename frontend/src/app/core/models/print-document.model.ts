export interface PrintTemplateConfigDto {
  id?: string;
  tenantId?: string;
  propertyId?: string | null;
  headerCompanyName: string;
  headerAddress: string;
  taxNumber: string;
  hotline: string;
  logoUrl?: string | null;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  footerNote: string;
  checkInPolicyText: string;
  showVietQrCode: boolean;
  defaultPaperSize: string;
}

export interface PrintInvoiceItemDto {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface PrintInvoiceDto {
  reservationId: string;
  invoiceNumber: string;
  confirmationCode: string;
  issuedDate: string;
  headerCompanyName: string;
  headerAddress: string;
  taxNumber: string;
  hotline: string;
  logoUrl?: string | null;
  propertyName: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomNumber: string;
  roomTypeName: string;
  rentalType: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  subTotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  paymentMethod: string;
  vietQrImageUrl: string;
  showVietQrCode: boolean;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankName: string;
  checkInPolicyText: string;
  footerNote: string;
  items: PrintInvoiceItemDto[];
}

export interface PrintVoucherDto {
  confirmationCode: string;
  createdAtUtc: string;
  propertyName: string;
  propertyAddress: string;
  propertyPhone: string;
  propertyEmail: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomTypeName: string;
  roomNumber: string;
  rentalType: string;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  numberOfGuests: number;
  totalAmount: number;
  status: string;
  bedType: string;
  squareMeters: number;
  policyNote: string;
  footerNote: string;
  specialRequests?: string | null;
  qrCodeData: string;
}

export interface PrintContractDto {
  contractId: string;
  contractNumber: string;
  createdAtUtc: string;
  signedDate: string;
  signedAtUtc?: string | null;
  status: string;
  isSigned: boolean;
  startDate: string;
  endDate: string;
  platformCompanyName: string;
  platformAddress: string;
  platformTaxCode: string;
  platformHotline: string;
  platformRepresentative: string;
  tenantCompanyName: string;
  tenantCode: string;
  tenantRepresentative: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantAddress: string;
  planCode: string;
  planName: string;
  contractType: string;
  billingCycle: string;
  contractValue: number;
  maxPropertiesAllowed: number;
  maxRoomsAllowed: number;
  digitalSignatureHash: string;
  termsAndConditions: string;
}
