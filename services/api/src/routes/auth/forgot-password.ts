export async function forgotPasswordHandler(): Promise<{ status: number; body: any }> {
  // Always return success to prevent email enumeration
  return {
    status: 200,
    body: { success: true }
  };
}
