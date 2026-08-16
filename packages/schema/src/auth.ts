import { z } from 'zod';

export const LoginInputSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    role: z.string(),
  }),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const SignupInputSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  company: z.string().min(2, 'Company name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type SignupInput = z.infer<typeof SignupInputSchema>;
