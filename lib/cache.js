// Caché en memoria simple (sin librerías externas) para reducir llamadas
// repetidas a la base de datos en datos que no cambian en cada request:
// catálogos (bonos, entidades, roles, etc.) y el listado de proyectos.
//
// Limitación a tener en cuenta: esto vive en la memoria del proceso de
// Node. En un servidor tradicional (o corriendo local con nodemon) el
// proceso se mantiene vivo, así que el caché funciona todo el tiempo que
// quiera. Si el backend se despliega como función serverless (Vercel,
// según vercel.json), cada "cold start" arranca con el caché vacío, y solo
// se reutiliza mientras la misma instancia siga "caliente" entre
// invocaciones. Sigue siendo una mejora real, pero no es tan predecible
// como un caché compartido (Redis, etc.) — eso sí requeriría una librería
// y/o un servicio nuevo, que por ahora no se agregó.
class Cache {
  constructor() {
    this.store = new Map(); // key -> { value, expiresAt }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key, value, ttlMs) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key) {
    this.store.delete(key);
  }

  // Útil para invalidar todas las entradas de un mismo grupo (ej. todas las
  // tablas genéricas) sin tener que conocer cada key exacta.
  deleteByPrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  // Patrón "cache-aside": si hay valor vigente lo devuelve; si no, ejecuta
  // fn(), guarda el resultado y lo devuelve. fn() solo se llama una vez por
  // "miss", incluso si el valor termina siendo falsy (0, "", null se cachean
  // igual, ya que lo relevante es si expiró, no si es truthy).
  async getOrSet(key, ttlMs, fn) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const value = await fn();
    this.set(key, value, ttlMs);
    return value;
  }
}

module.exports = new Cache();
