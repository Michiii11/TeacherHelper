export interface User{
  id: number;
  username: string;
  email: string;
  password: string;
}

export interface UserDTO{
  id: number;
  username: string;
  email: string;
  password: string;
}

export interface LoginDTO{
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  code: string;
  message: string;
  userId: number;
  token: string;
}
