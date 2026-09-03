// Tipos principales de la aplicación Panadería POS

export type Rol         = 'ADMIN' | 'GESTOR' | 'VENDEDOR';
export type TipoTurno   = 'MANIANA' | 'TARDE';
export type TipoProducto = 'HORNEADO' | 'REVENTA';
export type MedioPago   = 'EFECTIVO' | 'TRANSFERENCIA' | 'CUENTA_CORRIENTE' | 'MIXTO';

export interface Usuario {
  id:         string;
  auth_id:    string;
  nombre:     string;
  username:   string;
  rol:        Rol;
  activo:     boolean;
  creado_en:  number;
}

export interface Turno {
  id:         string;
  tipo:       TipoTurno;
  fecha:      string;
  usuario_id: string;
  inicio:     number;
  fin:        number | null;
  estado:     'ABIERTO' | 'CERRADO';
  usuarios?:  { nombre: string; rol: Rol };
}

export interface Categoria {
  id:     string;
  nombre: string;
  color:  string;
  orden:  number;
  activa: boolean;
}

export interface Producto {
  id:                    string;
  nombre:                string;
  precio:                number;
  precio_mayorista?:     number | null; // precio especial para clientes mayoristas
  tipo:                  TipoProducto;
  categoria_id:          string | null;
  stock:                 number;
  por_peso:              boolean;
  activo:                boolean;
  controla_vencimiento:  boolean;
  creado_en:             number;
}

export interface Promocion {
  id:          string;
  producto_id: string;
  tipo:        'CANTIDAD_FIJA';
  cantidad:    number;
  precio_total: number;
  activa:      boolean;
  descripcion: string | null;
}

export interface Cliente {
  id:         string;
  nombre:     string;
  telefono:   string | null;
  saldo_cc:   number;
  activo:     boolean;
  es_mayorista?: boolean; // si es true, usa precio_mayorista en ventas
  creado_en:  number;
}

export interface ItemCarrito {
  producto_id:     string;
  nombre:          string;
  cantidad:        number;
  por_peso:        boolean;
  precio_unitario: number;
  subtotal:        number;
  promo_id:        string | null;
  promo_aplicada:  boolean;
  promos_aplicadas?: string[];
}

export interface ItemCompra {
  producto_id:  string;
  nombre:       string;
  cantidad:     number;
  precio_costo: number;
  precio_venta: number;
  subtotal:     number;
}

export interface Proveedor {
  id:             string;
  nombre:         string;
  margen_default: number;
  activo:         boolean;
}
