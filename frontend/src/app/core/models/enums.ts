/** Khớp backend RoomStatus enum */
export enum RoomStatus {
  Clean = 'Clean',
  Dirty = 'Dirty',
  Cleaning = 'Cleaning',
  Occupied = 'Occupied',
  OutOfService = 'OutOfService'
}

/** Khớp backend GlobalUserRole enum */
export enum GlobalUserRole {
  SystemAdmin = 'SystemAdmin',
  TenantOwner = 'TenantOwner',
  Staff = 'Staff',
  Customer = 'Customer'
}

/** Label tiếng Việt cho RoomStatus */
export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  [RoomStatus.Clean]: 'Sạch',
  [RoomStatus.Dirty]: 'Cần dọn',
  [RoomStatus.Cleaning]: 'Đang dọn',
  [RoomStatus.Occupied]: 'Đang sử dụng',
  [RoomStatus.OutOfService]: 'Ngừng phục vụ'
};

/** Màu badge cho RoomStatus */
export const ROOM_STATUS_COLORS: Record<RoomStatus, string> = {
  [RoomStatus.Clean]: '#4caf50',
  [RoomStatus.Dirty]: '#f44336',
  [RoomStatus.Cleaning]: '#ff9800',
  [RoomStatus.Occupied]: '#2196f3',
  [RoomStatus.OutOfService]: '#9e9e9e'
};
