// services/poolbar-demo-seed.js

/* ═══════════════════════════════════════════════
   DEMO SEED DATA — deleted on go-live

   Nothing outside poolbar-data.js imports from this file, and
   poolbar-data.js only ever reads it when CONFIG.USE_DEMO is true
   (see poolbar-config.js). Once you flip USE_DEMO to false this file
   is never touched at runtime — at that point it's safe to delete it
   and remove the one import line at the top of poolbar-data.js.
   Nothing else needs to change.
═══════════════════════════════════════════════ */

export const DEMO_STOCK = [
  { name: 'Heineken', category: 'Beers', unit: 'Bottles', qty: 48, min: 12, batch: 'REQ-00031', received: '17/07/26', price: 1500, desc: '33cl chilled beer' },
  { name: 'Guinness', category: 'Beers', unit: 'Bottles', qty: 36, min: 12, batch: 'REQ-00031', received: '17/07/26', price: 1600, desc: 'Stout, 33cl' },
  { name: 'Star Lager', category: 'Beers', unit: 'Bottles', qty: 8, min: 12, batch: 'REQ-00029', received: '15/07/26', price: 1200, desc: '33cl chilled beer' },
  { name: 'Hennessy VS', category: 'Spirits', unit: 'Bottles', qty: 5, min: 3, batch: 'REQ-00027', received: '14/07/26', price: 4000, desc: 'Premium cognac, per shot billed' },
  { name: 'Johnnie Walker', category: 'Spirits', unit: 'Bottles', qty: 3, min: 3, batch: 'REQ-00026', received: '13/07/26', price: 4500, desc: 'Blended scotch whisky' },
  { name: 'Baileys', category: 'Spirits', unit: 'Bottles', qty: 4, min: 2, batch: 'REQ-00025', received: '12/07/26', price: 3500, desc: 'Irish cream liqueur' },
  { name: 'Moët & Chandon', category: 'Wines', unit: 'Bottles', qty: 6, min: 3, batch: 'REQ-00024', received: '11/07/26', price: 55000, desc: '750ml champagne' },
  { name: 'Chapman Mix', category: 'Soft Drinks', unit: 'Litres', qty: 10, min: 5, batch: 'REQ-00031', received: '17/07/26', price: 2500, desc: 'Classic Nigerian mocktail mix' },
  { name: 'Maltina', category: 'Soft Drinks', unit: 'Cans', qty: 5, min: 12, batch: 'REQ-00030', received: '16/07/26', price: 800, desc: 'Malt drink' },
  { name: 'Bottled Water', category: 'Water', unit: 'Bottles', qty: 72, min: 24, batch: 'REQ-00031', received: '17/07/26', price: 500, desc: '750ml still water' },
  { name: 'Mojito Mix', category: 'Cocktails', unit: 'Litres', qty: 3, min: 2, batch: 'REQ-00028', received: '14/07/26', price: 5500, desc: 'Rum, mint, lime, soda' },
  { name: 'Pina Colada Mix', category: 'Cocktails', unit: 'Litres', qty: 2, min: 2, batch: 'REQ-00028', received: '14/07/26', price: 6000, desc: 'Rum, coconut, pineapple' },
  { name: 'Pringles', category: 'Snacks', unit: 'Packs', qty: 20, min: 10, batch: 'REQ-00029', received: '15/07/26', price: 2000, desc: 'Assorted flavours' },
  { name: 'Chin Chin', category: 'Snacks', unit: 'Packs', qty: 15, min: 10, batch: 'REQ-00029', received: '15/07/26', price: 1500, desc: 'Nigerian fried snack' },
  { name: 'Ice Cream Tubs', category: 'Ice Cream', unit: 'Pieces', qty: 0, min: 4, batch: 'REQ-00022', received: '09/07/26', price: 2500, desc: 'Assorted scoops' },
];

export const DEMO_SALES = [
  { id: 'PBS-1012', items: [{ name: 'Heineken', qty: 3, price: 1500 }], subtotal: 4500, discount: 0, total: 4500, method: 'Cash', staff: 'Emeka S.', table: 'Pool Deck 2', notes: '', date: '17/07/26 11:05 AM', status: 'completed' },
  { id: 'PBS-1011', items: [{ name: 'Chapman', qty: 2, price: 2500 }, { name: 'Guinness', qty: 2, price: 1600 }], subtotal: 8200, discount: 0, total: 8200, method: 'POS', staff: 'Amaka O.', table: 'Pool Lounge', notes: '', date: '17/07/26 10:40 AM', status: 'completed' },
  { id: 'PBS-1010', items: [{ name: 'Guinness', qty: 1, price: 1600 }], subtotal: 1600, discount: 0, total: 1600, method: 'Transfer', staff: 'Emeka S.', table: 'Pool Deck 1', notes: '', date: '17/07/26 09:52 AM', status: 'completed' },
  { id: 'PBS-1009', items: [{ name: 'Heineken', qty: 4, price: 1500 }, { name: 'Chapman', qty: 1, price: 2500 }], subtotal: 8500, discount: 10, total: 7650, method: 'Room Charge', staff: 'Amaka O.', table: 'Pool Deck 4', notes: '', date: '16/07/26 07:30 PM', status: 'completed' },
  { id: 'PBS-1008', items: [{ name: 'Guinness', qty: 2, price: 1600 }], subtotal: 3200, discount: 0, total: 3200, method: 'Cash', staff: 'Emeka S.', table: 'Pool Deck 1', notes: 'Wrong order', date: '16/07/26 01:15 PM', status: 'voided', voidReason: 'Customer changed mind before it was served', voidDate: '16/07/26 01:20 PM', voidedBy: 'Adaeze Nwankwo (Duty Manager)' },
];

export const DEMO_ORDERS = [];

export const DEMO_PENDING = [
  { no: 'REQ-00034', item: 'Moët & Chandon', qty: 6, unit: 'Bottles', from: 'Main Store', sentBy: 'Store Keeper', date: '17/07/26 09:40 AM', prodNo: 'STK-00512' },
  { no: 'REQ-00035', item: 'Bottled Water', qty: 48, unit: 'Bottles', from: 'Main Store', sentBy: 'Store Keeper', date: '17/07/26 10:10 AM', prodNo: 'STK-00518' },
];

export const DEMO_MOVEMENTS = [];

export const DEMO_SESSION = {
  name: 'Pool Bar Manager',
  initials: 'PB',
  role: 'manager', // aligned with permissions.js role set (admin | manager | staff)
  privilege: 'pool_bar_staff',
};