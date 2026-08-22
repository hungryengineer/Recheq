import { z } from 'zod';

export const ProfileUpdateInputSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  email: z.string().email('Please enter a valid email address'),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInputSchema>;

export const PasswordUpdateInputSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type PasswordUpdateInput = z.infer<typeof PasswordUpdateInputSchema>;

export const OrganizationUpdateInputSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters long'),
});

export type OrganizationUpdateInput = z.infer<typeof OrganizationUpdateInputSchema>;

export const InviteMemberInputSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['Owner', 'Verifier', 'Viewer'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
});

export type InviteMemberInput = z.infer<typeof InviteMemberInputSchema>;
