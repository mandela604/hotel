/**
 * guestController.js
 *
 * NOTE: All guest endpoints (listGuests, getGuest, saveGuest, addCharge,
 * settleCharge, settleAllCharges) are implemented in bookingController.js
 * and mounted under /api/booking by server.js.
 *
 * This file previously imported a non-existent RoomCharge model and
 * defined duplicate handlers that were never wired into any route, which
 * would have caused a crash on require(). It has been cleaned up — do not
 * add new guest logic here; extend bookingController.js instead.
 */
