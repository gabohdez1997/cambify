-- 1. Eliminar la regla anterior que permitía a todos ver todos los movimientos
DROP POLICY IF EXISTS "Everyone can view cash movements" ON cash_movements;

-- 2. Crear nueva regla de Aislamiento (Caja Ciega): Cada usuario (por su auth.uid) solo puede leer movimientos donde el user_id sea el suyo
CREATE POLICY "Users can only view their own cash movements" 
ON cash_movements FOR SELECT 
USING (
    user_id = auth.uid()
);
