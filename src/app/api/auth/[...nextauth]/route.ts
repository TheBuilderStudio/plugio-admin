/**
 * NextAuth v5 Route Handler
 * Handles all Google OAuth2 callbacks: GET /api/auth/*, POST /api/auth/*
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
