// ═══════════════════════════════════════════════════════════════
// STOCK MODULE BARREL — re-exports everything from modules/stock
// ═══════════════════════════════════════════════════════════════

// Models
export * from './models/stock.models';

// Services
export { ComponentService }       from './services/component.service';
export { SupplierService }        from './services/supplier.service';
export { LotService }             from './services/lot.service';
export { StorageLocationService } from './services/storage-location.service';
export { ReelService }            from './services/reel.service';
