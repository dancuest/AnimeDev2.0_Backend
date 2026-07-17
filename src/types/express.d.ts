// Este archivo forma parte de la estructura del proyecto y ayuda a organizar una funcionalidad concreta del backend.

declare namespace Express {
  interface Request {
    requestId?: string;
  }
}
