export interface PrintTemplateConfigDto {
  headerCompanyName: string;
  headerAddress: string;
  taxNumber: string;
  hotline: string;
  logoUrl?: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  footerNote: string;
  checkInPolicyText: string;
  showVietQrCode: boolean;
  defaultPaperSize: string;
}

export interface PrintInvoiceItemDto {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  note?: string;
}

export interface PrintInvoiceDto {
  hotelInfo: PrintTemplateConfigDto;
  reservationId: string;
  invoiceNumber: string;
  issuedDate: string;
  guestName: string;
  guestPhone: string;
  roomNumber: string;
  roomTypeName: string;
  propertyName: string;
  rentalType: string;
  checkInActual: string;
  checkOutActual: string;
  roomRate: number;
  durationText: string;
  roomTotal: number;
  surchargeTotal: number;
  serviceTotal: number;
  discountTotal: number;
  loyaltyPointsUsed: number;
  loyaltyDiscountAmount: number;
  subTotal: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  paymentMethod: string;
  vietQrUrl: string;
  lineItems: PrintInvoiceItemDto[];
}

export interface PrintVoucherDto {
  hotelInfo: PrintTemplateConfigDto;
  confirmationCode: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  propertyName: string;
  propertyAddress: string;
  propertyPhone: string;
  roomTypeName: string;
  roomCount: number;
  checkInDate: string;
  checkOutDate: string;
  rentalType: string;
  guestCount: number;
  specialRequests?: string;
  totalAmount: number;
  holdStatus: string;
  qrCodeUrl: string;
}

export interface PrintContractDto {
  contractId: string;
  contractNumber: string;
  createdAt: string;
  providerName: string;
  providerAddress: string;
  providerTaxCode: string;
  providerRepresentative: string;
  providerHotline: string;
  tenantName: string;
  tenantCode: string;
  tenantAddress: string;
  tenantTaxCode: string;
  representativeName: string;
  representativeEmail: string;
  representativePhone: string;
  planCode: string;
  planName: string;
  contractType: string;
  startDate: string;
  endDate: string;
  billingCycle: string;
  contractValue: number;
  status: string;
  signedAtUtc?: string;
  digitalSignatureHash?: string;
  termsAndConditions: string;
}
