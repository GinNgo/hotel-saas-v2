export type TenantContractStatus = 'Draft' | 'PendingSignature' | 'Active' | 'Expired' | 'Terminated';

export interface TenantContractDto {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantCode?: string;
  contractNumber: string;
  planCode: string;
  planName: string;
  contractType: string;
  representativeName: string;
  representativeEmail: string;
  representativePhone: string;
  startDate: string;
  endDate: string;
  billingCycle: string;
  contractValue: number;
  status: TenantContractStatus;
  slaCommitment?: string;
  signedAtUtc?: string;
  digitalSignatureHash?: string;
  termsAndConditions?: string;
  notes?: string;
  createdAtUtc: string;
}

export interface CreateTenantContractRequest {
  tenantId: string;
  planCode: string;
  planName: string;
  contractType: string;
  representativeName: string;
  representativeEmail: string;
  representativePhone: string;
  startDate: string;
  endDate: string;
  billingCycle: number;
  contractValue: number;
  termsAndConditions?: string;
  notes?: string;
}

export interface UpdateContractStatusRequest {
  status: string;
  digitalSignatureHash?: string;
  notes?: string;
}
