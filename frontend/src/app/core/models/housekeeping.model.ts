import { RoomStatus } from './enums';

export enum HousekeepingTaskStatus {
  Pending = 'Pending',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Claimed = 'Claimed'
}

export enum HousekeepingPriority {
  Low = 'Low',
  Normal = 'Normal',
  High = 'High',
  Urgent = 'Urgent'
}

export const HOUSEKEEPING_TASK_STATUS_LABELS: Record<HousekeepingTaskStatus, string> = {
  [HousekeepingTaskStatus.Pending]: 'Chờ nhận',
  [HousekeepingTaskStatus.Claimed]: 'Đã nhận việc',
  [HousekeepingTaskStatus.InProgress]: 'Đang dọn',
  [HousekeepingTaskStatus.Completed]: 'Hoàn tất sạch'
};

export const HOUSEKEEPING_PRIORITY_LABELS: Record<HousekeepingPriority, string> = {
  [HousekeepingPriority.Low]: 'Thấp',
  [HousekeepingPriority.Normal]: 'Bình thường',
  [HousekeepingPriority.High]: 'Cao',
  [HousekeepingPriority.Urgent]: 'Khẩn cấp'
};

export interface HousekeepingTaskDto {
  id: string;
  roomId: string;
  roomNumber: string;
  floor: number;
  roomTypeName: string;
  roomStatus: RoomStatus;
  status: HousekeepingTaskStatus;
  priority: HousekeepingPriority;
  effectivePriority: HousekeepingPriority;
  hasUpcomingCheckIn: boolean;
  nextCheckInAtUtc?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  notes?: string | null;
  startedAtUtc?: string | null;
  completedAtUtc?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface HousekeepingStaffOptionDto {
  userId: string;
  fullName: string;
  staffRole: string;
}

export interface CreateHousekeepingTaskRequest {
  propertyId: string;
  roomId: string;
  priority?: HousekeepingPriority;
  notes?: string | null;
  assignedToUserId?: string | null;
}
