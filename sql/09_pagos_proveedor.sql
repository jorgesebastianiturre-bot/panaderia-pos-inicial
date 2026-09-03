-- Tabla de pagos a proveedores
CREATE TABLE IF NOT EXISTS public.pagos_proveedor (
  id           TEXT PRIMARY KEY,
  proveedor_id TEXT NOT NULL REFERENCES public.proveedores(id),
  monto        NUMERIC NOT NULL,
  medio_pago   TEXT NOT NULL DEFAULT 'EFECTIVO',
  notas        TEXT,
  usuario_id   TEXT REFERENCES public.usuarios(id),
  fecha        BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000
);
ALTER TABLE public.pagos_proveedor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pagos_prov_all" ON public.pagos_proveedor;
CREATE POLICY "pagos_prov_all" ON public.pagos_proveedor USING (true) WITH CHECK (true);

-- Columna notas en movimientos_stock
ALTER TABLE public.movimientos_stock ADD COLUMN IF NOT EXISTS notas TEXT;

-- Precio mayorista en productos
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS precio_mayorista NUMERIC;

-- es_insumo en categorias
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS es_insumo BOOLEAN NOT NULL DEFAULT false;

-- Política eliminar cierres
DROP POLICY IF EXISTS "cierres_delete" ON public.cierres;
CREATE POLICY "cierres_delete" ON public.cierres FOR DELETE USING (true);
