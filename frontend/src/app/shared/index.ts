/**
 * Barrel export tập trung cho toàn bộ Shared Module (Components, Pipes, Directives).
 * Quy tắc chuẩn: Các trang Feature BẮT BUỘC tái sử dụng các components này thay vì tự viết lại HTML/CSS.
 */

// Shared Components
export * from './components/page-header/page-header';
export * from './components/status-badge/status-badge.component';
export * from './components/stat-card/stat-card.component';
export * from './components/pagination/pagination.component';
export * from './components/empty-state/empty-state.component';
export * from './components/loading-spinner/loading-spinner';
export * from './components/skeleton-table/skeleton-table.component';
export * from './components/date-range-filter/date-range-filter.component';
export * from './components/booking-date-picker/booking-date-picker.component';
export * from './components/photo-gallery-modal/photo-gallery-modal.component';
export * from './components/room-detail-modal/room-detail-modal.component';
export * from './components/searchable-select/searchable-select.component';
export * from './components/google-map-picker/google-map-picker.component';
export * from './components/form-field/form-field.component';
export * from './components/notification-bell/notification-bell.component';

// Shared Pipes
export * from './pipes/business-date.pipe';
