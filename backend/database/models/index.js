/**
 * Grace Hotel — Models Index
 * Re-exports all models so other files can:
 *   const models = require('../database/models');
 */

const basePlugin = require('./base').basePlugin;

// Import all models
const User = require('./User');
const Role = require('./Role');
const Room = require('./Room');
const Booking = require('./Booking');
const MenuItem = require('./MenuItem');
const RestaurantTable = require('./RestaurantTable');
const Sale = require('./Sale');
const SaleItem = require('./SaleItem');
const KitchenInventory = require('./KitchenInventory');
const KitchenProduction = require('./KitchenProduction');
const KitchenTransfer = require('./KitchenTransfer');
const StoreItem = require('./StoreItem');
const Requisition = require('./Requisition');
const RequisitionItem = require('./RequisitionItem');
const Supplier = require('./Supplier');
const PurchaseRequest = require('./PurchaseRequest');
const GymPlan = require('./GymPlan');
const GymMember = require('./GymMember');
const GymCheckin = require('./GymCheckin');
const Staff = require('./Staff');
const AccountingTransaction = require('./AccountingTransaction');
const ActivityLog = require('./ActivityLog');
const Config = require('./Config');
const Shift = require('./Shift');
const Transfer = require('./Transfer');
const Payment = require('./Payment');

module.exports = {
  User,
  Role,
  Room,
  Booking,
  MenuItem,
  RestaurantTable,
  Sale,
  SaleItem,
  KitchenInventory,
  KitchenProduction,
  KitchenTransfer,
  StoreItem,
  Requisition,
  RequisitionItem,
  Supplier,
  PurchaseRequest,
  GymPlan,
  GymMember,
  GymCheckin,
  Staff,
  AccountingTransaction,
  ActivityLog,
  Config,
  Shift,
  Transfer,
  Payment,
};