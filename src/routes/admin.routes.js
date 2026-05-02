// src/routes/admin.routes.js
import { Router } from 'express'
import { requireAdmin } from '../middleware/adminAuth.js'
import {
  adminLogin,
  getAllRooms, createRoom, updateRoom, deleteRoom,
  getAllBookings, updateBookingStatus,
  getStats,
} from '../controllers/admin.controller.js'

const router = Router()

// Public — login only
router.post('/login', adminLogin)

// All routes below need admin token
router.use(requireAdmin)

// Stats
router.get('/stats', getStats)

// Rooms CRUD
router.get('/rooms',        getAllRooms)
router.post('/rooms',       createRoom)
router.put('/rooms/:id',    updateRoom)
router.delete('/rooms/:id', deleteRoom)

// Bookings
router.get('/bookings',              getAllBookings)
router.put('/bookings/:id/status',   updateBookingStatus)

export default router
