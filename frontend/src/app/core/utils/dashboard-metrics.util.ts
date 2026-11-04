import { AdminSubscriptionPlanDto } from '../models/admin-plan.model';
import { TenantContractDto } from '../models/admin-contract.model';
import { TenantPropertySummaryDto } from '../models/public-booking.model';
import { RoomStatus } from '../models/enums';

export interface PlatformDashboardMetrics {
  totalPlans: number;
  activePlans: number;
  popularPlanName: string;
  totalContracts: number;
  activeContracts: number;
  pendingContracts: number;
  draftOrExpiredContracts: number;
  totalCommittedValue: number;
  averageContractValue: number;
}

export interface ChainHqDashboardMetrics {
  totalProperties: number;
  activeProperties: number;
  inactiveProperties: number;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  occupancyRate: number;
  todayChainRevenue: number;
}

export interface PropertyRoomDashboardMetrics {
  totalRooms: number;
  cleanRooms: number;
  occupiedRooms: number;
  dirtyRooms: number;
  cleaningRooms: number;
  oosRooms: number;
  readyRate: number;
  occupancyRate: number;
}

export function computePlatformMetrics(
  plans: AdminSubscriptionPlanDto[],
  contracts: TenantContractDto[]
): PlatformDashboardMetrics {
  const safePlans = Array.isArray(plans) ? plans : [];
  const safeContracts = Array.isArray(contracts) ? contracts : [];

  const activePlansList = safePlans.filter(p => p.isActive);
  const popular = safePlans.find(p => p.isPopular) || activePlansList[0];

  const activeContractsList = safeContracts.filter(c => c.status === 'Active');
  const pendingContractsList = safeContracts.filter(c => c.status === 'PendingSignature');
  const draftOrExpired = safeContracts.filter(
    c => c.status !== 'Active' && c.status !== 'PendingSignature'
  );

  const validValueContracts = safeContracts.filter(c => c.status !== 'Terminated');
  const totalCommittedValue = validValueContracts.reduce(
    (sum, c) => sum + (Number(c.contractValue) || 0),
    0
  );

  const averageContractValue =
    validValueContracts.length > 0
      ? Math.round(totalCommittedValue / validValueContracts.length)
      : 0;

  return {
    totalPlans: safePlans.length,
    activePlans: activePlansList.length,
    popularPlanName: popular?.name || 'Tiêu chuẩn',
    totalContracts: safeContracts.length,
    activeContracts: activeContractsList.length,
    pendingContracts: pendingContractsList.length,
    draftOrExpiredContracts: draftOrExpired.length,
    totalCommittedValue,
    averageContractValue
  };
}

export function computeChainHqMetrics(
  properties: TenantPropertySummaryDto[]
): ChainHqDashboardMetrics {
  const safeProps = Array.isArray(properties) ? properties : [];
  const activeProps = safeProps.filter(p => p.isActive !== false);
  const inactiveProps = safeProps.filter(p => p.isActive === false);

  const totalRooms = safeProps.reduce((sum, p) => sum + (Number(p.totalRooms) || 0), 0);
  const occupiedRooms = safeProps.reduce((sum, p) => sum + (Number(p.occupiedRooms) || 0), 0);
  const availableRooms = Math.max(0, totalRooms - occupiedRooms);
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const todayChainRevenue = safeProps.reduce((sum, p) => sum + (Number(p.todayRevenue) || 0), 0);

  return {
    totalProperties: safeProps.length,
    activeProperties: activeProps.length,
    inactiveProperties: inactiveProps.length,
    totalRooms,
    occupiedRooms,
    availableRooms,
    occupancyRate,
    todayChainRevenue
  };
}

export function computePropertyRoomMetrics(
  rooms: ReadonlyArray<{ status: RoomStatus | string }>
): PropertyRoomDashboardMetrics {
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const totalRooms = safeRooms.length;
  const cleanRooms = safeRooms.filter(r => r.status === RoomStatus.Clean).length;
  const occupiedRooms = safeRooms.filter(r => r.status === RoomStatus.Occupied).length;
  const dirtyRooms = safeRooms.filter(r => r.status === RoomStatus.Dirty).length;
  const cleaningRooms = safeRooms.filter(r => r.status === RoomStatus.Cleaning).length;
  const oosRooms = safeRooms.filter(r => r.status === RoomStatus.OutOfService).length;

  const readyRate = totalRooms > 0 ? Math.round((cleanRooms / totalRooms) * 100) : 0;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  return {
    totalRooms,
    cleanRooms,
    occupiedRooms,
    dirtyRooms,
    cleaningRooms,
    oosRooms,
    readyRate,
    occupancyRate
  };
}
