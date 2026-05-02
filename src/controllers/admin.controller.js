// src/controllers/admin.controller.js
import jwt    from 'jsonwebtoken'
import prisma from '../config/db.js'

// ── POST /api/admin/login ─────────────────────────────────────
export async function adminLogin(req, res, next) {
  try {
    const { username, password } = req.body

    const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin'
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123'

    if (username !== ADMIN_USER || password !== ADMIN_PASS) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { role: 'admin', username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({ token, message: 'Admin login successful' })
  } catch (e) { next(e) }
}

// ── GET /api/admin/rooms ──────────────────────────────────────
export async function getAllRooms(req, res, next) {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    })
    res.json({ rooms })
  } catch (e) { next(e) }
}

// ── POST /api/admin/rooms ─────────────────────────────────────
export async function createRoom(req, res, next) {
  try {
    const {
      name, type, price, capacity, size,
      description, highlights, amenities,
      images, badge,
    } = req.body

    if (!name || !type || !price || !capacity) {
      return res.status(400).json({ error: 'name, type, price, capacity required' })
    }

    // auto-generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      + '-' + Date.now()

    const room = await prisma.room.create({
      data: {
        name,
        slug,
        type:        type.toUpperCase(),
        price:       parseInt(price),
        capacity:    parseInt(capacity),
        size:        size        || '',
        description: description || '',
        highlights:  highlights  || [],
        amenities:   amenities   || [],
        images:      images      || [],
        badge:       badge       || null,
        active:      true,
      },
    })

    res.status(201).json({ room, message: 'Room created successfully' })
  } catch (e) { next(e) }
}

// ── PUT /api/admin/rooms/:id ──────────────────────────────────
export async function updateRoom(req, res, next) {
  try {
    const { id } = req.params
    const {
      name, price, capacity, size,
      description, highlights, amenities,
      images, badge, active,
    } = req.body

    const existing = await prisma.room.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Room not found' })

    const data = {}
    if (name        !== undefined) data.name        = name
    if (price       !== undefined) data.price       = parseInt(price)
    if (capacity    !== undefined) data.capacity    = parseInt(capacity)
    if (size        !== undefined) data.size        = size
    if (description !== undefined) data.description = description
    if (highlights  !== undefined) data.highlights  = highlights
    if (amenities   !== undefined) data.amenities   = amenities
    if (images      !== undefined) data.images      = images
    if (badge       !== undefined) data.badge       = badge || null
    if (active      !== undefined) data.active      = active

    const room = await prisma.room.update({ where: { id }, data })
    res.json({ room, message: 'Room updated successfully' })
  } catch (e) { next(e) }
}

// ── DELETE /api/admin/rooms/:id ───────────────────────────────
export async function deleteRoom(req, res, next) {
  try {
    const { id } = req.params

    // check no active bookings
    const activeBookings = await prisma.booking.count({
      where: { roomId: id, status: { in: ['PENDING', 'CONFIRMED'] } },
    })
    if (activeBookings > 0) {
      return res.status(400).json({
        error: `Cannot delete — ${activeBookings} active booking(s) exist for this room`,
      })
    }

    await prisma.room.delete({ where: { id } })
    res.json({ message: 'Room deleted successfully' })
  } catch (e) { next(e) }
}

// ── GET /api/admin/bookings ───────────────────────────────────
export async function getAllBookings(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const where = status ? { status: status.toUpperCase() } : {}

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { room: { select: { name: true, type: true } } },
        orderBy: { createdAt: 'desc' },
        skip:  (parseInt(page) - 1) * parseInt(limit),
        take:  parseInt(limit),
      }),
      prisma.booking.count({ where }),
    ])

    res.json({ bookings, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (e) { next(e) }
}

// ── PUT /api/admin/bookings/:id/status ────────────────────────
export async function updateBookingStatus(req, res, next) {
  try {
    const { id }     = req.params
    const { status } = req.body

    const valid = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const booking = await prisma.booking.update({
      where: { id },
      data:  { status },
      include: { room: { select: { name: true } } },
    })

    res.json({ booking, message: `Booking ${status.toLowerCase()}` })
  } catch (e) { next(e) }
}

// ── GET /api/admin/stats ──────────────────────────────────────
export async function getStats(req, res, next) {
  try {
    const [totalRooms, totalBookings, confirmedBookings, pendingBookings, revenueData] =
      await Promise.all([
        prisma.room.count({ where: { active: true } }),
        prisma.booking.count(),
        prisma.booking.count({ where: { status: 'CONFIRMED' } }),
        prisma.booking.count({ where: { status: 'PENDING' } }),
        prisma.booking.aggregate({
          _sum: { totalAmount: true },
          where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
        }),
      ])

    res.json({
      totalRooms,
      totalBookings,
      confirmedBookings,
      pendingBookings,
      totalRevenue: revenueData._sum.totalAmount || 0,
    })
  } catch (e) { next(e) }
}
