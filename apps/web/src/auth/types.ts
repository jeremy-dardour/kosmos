export interface AuthenticatedUser {
  username: string;
  name?: string;
}

export enum AuthEvent {
  LOGIN_SUCCESS = 'auth:login-success',
  LOGOUT_SUCCESS = 'auth:logout-success',
}

export interface AuthMessage {
  type: AuthEvent;
  timestamp: number;
}
