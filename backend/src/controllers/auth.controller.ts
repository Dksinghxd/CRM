import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/error.middleware';

const generateToken = (userId: string, email: string, role: string): string => {
  const secret = process.env.JWT_SECRET || 'fallback_secret_key_32_chars_min';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ userId, email, role }, secret, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
};

// POST /api/auth/register
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({
      success: false,
      message: 'An account with this email already exists.',
    });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: role || 'ADMIN',
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      createdAt: true,
    },
  });

  const token = generateToken(user.id, user.email, user.role);

  res.status(201).json({
    success: true,
    message: 'Account created successfully.',
    data: {
      user,
      token,
    },
  });
});

// POST /api/auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Invalid email or password.',
    });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    res.status(401).json({
      success: false,
      message: 'Invalid email or password.',
    });
    return;
  }

  const token = generateToken(user.id, user.email, user.role);

  res.status(200).json({
    success: true,
    message: 'Login successful.',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      token,
    },
  });
});

// GET /api/auth/me
export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated.' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { campaigns: true },
      },
    },
  });

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }

  res.status(200).json({
    success: true,
    data: { user },
  });
});

// PUT /api/auth/profile
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated.' });
    return;
  }

  const { name, avatar } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user.userId },
    data: {
      ...(name && { name }),
      ...(avatar !== undefined && { avatar }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      updatedAt: true,
    },
  });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully.',
    data: { user },
  });
});

// PUT /api/auth/change-password
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated.' });
    return;
  }

  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  res.status(200).json({
    success: true,
    message: 'Password changed successfully.',
  });
});
