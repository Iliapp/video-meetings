// The caller of a request guarded by `JwtAuthGuard`.
export interface AuthUser {
  id: string;
  email: string;
}
