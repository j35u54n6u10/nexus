import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'

// --- SEED LOCAL DEMO DATA (Por si no hay conexión a Supabase) ---
const INITIAL_CATEGORIES = [
  { id: 1, nombre: 'Proteínas' },
  { id: 2, nombre: 'Víveres' },
  { id: 3, nombre: 'Verduras y Hortalizas' },
  { id: 4, nombre: 'Lácteos y Refrigerados' },
  { id: 5, nombre: 'Empaques y Descartables' }
]

const INITIAL_PRODUCTS = [
  { id: 'p1', nombre: 'Pechuga de Pollo', categoria_id: 1, unidad_medida: 'kg', stock_actual: 35.0, stock_minimo: 15.0 },
  { id: 'p2', nombre: 'Carne de Res Molida', categoria_id: 1, unidad_medida: 'kg', stock_actual: 35.0, stock_minimo: 20.0 },
  { id: 'p3', nombre: 'Arroz Blanco', categoria_id: 2, unidad_medida: 'kg', stock_actual: 35.0, stock_minimo: 50.0 }, // Bajo stock
  { id: 'p4', nombre: 'Aceite Vegetal', categoria_id: 2, unidad_medida: 'litros', stock_actual: 35.0, stock_minimo: 10.0 },
  { id: 'p5', nombre: 'Tomate', categoria_id: 3, unidad_medida: 'kg', stock_actual: 5.0, stock_minimo: 8.0 }, // Bajo stock (de semilla)
  { id: 'p6', nombre: 'Cebolla Cabezoña', categoria_id: 3, unidad_medida: 'kg', stock_actual: 35.0, stock_minimo: 8.0 },
  { id: 'p7', nombre: 'Queso Doble Crema', categoria_id: 4, unidad_medida: 'kg', stock_actual: 2.0, stock_minimo: 5.0 }, // Bajo stock (de semilla)
  { id: 'p8', nombre: 'Leche Entera', categoria_id: 4, unidad_medida: 'litros', stock_actual: 35.0, stock_minimo: 24.0 },
  { id: 'p9', nombre: 'Envase Desechable Almuerzo', categoria_id: 5, unidad_medida: 'unidades', stock_actual: 35.0, stock_minimo: 100.0 }, // Bajo stock
  { id: 'p10', nombre: 'Servilletas de Papel', categoria_id: 5, unidad_medida: 'paquetes', stock_actual: 35.0, stock_minimo: 10.0 }
]

const INITIAL_MOVEMENTS = [
  { id: 'm1', producto_id: 'p1', tipo: 'Entrada', cantidad: 35.0, motivo: 'Carga inicial de inventario - Semilla', usuario_email: 'chef.demo@nexus.com', creado_en: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: 'm2', producto_id: 'p5', tipo: 'Entrada', cantidad: 35.0, motivo: 'Carga inicial de inventario - Semilla', usuario_email: 'chef.demo@nexus.com', creado_en: new Date(Date.now() - 3600000 * 3).toISOString() },
  { id: 'm3', producto_id: 'p7', tipo: 'Entrada', cantidad: 35.0, motivo: 'Carga inicial de inventario - Semilla', usuario_email: 'chef.demo@nexus.com', creado_en: new Date(Date.now() - 3600000 * 4).toISOString() },
  { id: 'm4', producto_id: 'p5', tipo: 'Salida', cantidad: 30.0, motivo: 'Preparación ensaladas almuerzo del lunes', usuario_email: 'chef.demo@nexus.com', creado_en: new Date(Date.now() - 600000 * 5).toISOString() },
  { id: 'm5', producto_id: 'p7', tipo: 'Salida', cantidad: 33.0, motivo: 'Preparación de desayunos de la semana', usuario_email: 'chef.demo@nexus.com', creado_en: new Date(Date.now() - 600000 * 2).toISOString() }
]

export default function App() {
  // --- ESTADOS ---
  const [isDemoMode, setIsDemoMode] = useState(true)
  const [supabaseConnected, setSupabaseConnected] = useState(false)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  
  // Datos
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  
  // UI Tabs / Vistas
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' | 'historial' | 'alertas'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  
  // Modales
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [selectedProductForMov, setSelectedProductForMov] = useState(null)
  const [movementType, setMovementType] = useState('Entrada')
  const [movementQty, setMovementQty] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [movementError, setMovementError] = useState('')
  
  const [showProductModal, setShowProductModal] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductCategory, setNewProductCategory] = useState('')
  const [newProductUnit, setNewProductUnit] = useState('kg')
  const [newProductMinStock, setNewProductMinStock] = useState('')
  const [newProductError, setNewProductError] = useState('')

  // Toast / Notificaciones
  const [toast, setToast] = useState(null) // { type: 'success'|'error', message: '' }

  // Formulario Auth
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [authErrorMsg, setAuthErrorMsg] = useState('')

  // --- DETECCION DE CREDENCIALES Y AUTENTICACION ---
  useEffect(() => {
    const checkSupabaseConfig = async () => {
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      const isPlaceholder = 
        !url || 
        !key || 
        url.includes('REEMPLAZAR') || 
        key.includes('REEMPLAZAR')
        
      if (isPlaceholder) {
        // Inicializar Demo Local
        setIsDemoMode(true)
        setSupabaseConnected(false)
        setAuthLoading(false)
        loadLocalData()
        
        // Cargar sesión de usuario demo si existe
        const savedDemoUser = localStorage.getItem('nexus_demo_user')
        if (savedDemoUser) {
          setUser(JSON.parse(savedDemoUser))
        }
      } else {
        // Intentar conectar con Supabase
        try {
          setIsDemoMode(false)
          setSupabaseConnected(true)
          
          // Escuchar cambios de autenticación
          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
              setUser(session.user)
            } else {
              setUser(null)
            }
            setAuthLoading(false)
          })
          
          // Verificar sesión actual
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            setUser(session.user)
          } else {
            setUser(null)
          }
          
          return () => {
            subscription?.unsubscribe()
          }
        } catch (e) {
          console.error("Error al conectar con Supabase, cayendo a modo Demo:", e)
          setIsDemoMode(true)
          setSupabaseConnected(false)
          setAuthLoading(false)
          loadLocalData()
        }
      }
    }
    
    checkSupabaseConfig()
  }, [])

  // Cargar datos cuando el usuario inicia sesión o cambia de modo
  useEffect(() => {
    if (isDemoMode) {
      loadLocalData()
    } else if (user) {
      fetchSupabaseData()
    }
  }, [user, isDemoMode])

  // --- MÉTODOS DE DATOS LOCALES (LOCALSTORAGE) ---
  const loadLocalData = () => {
    // Categorías
    setCategories(INITIAL_CATEGORIES)
    
    // Productos
    const localProducts = localStorage.getItem('nexus_products')
    if (!localProducts) {
      localStorage.setItem('nexus_products', JSON.stringify(INITIAL_PRODUCTS))
      setProducts(INITIAL_PRODUCTS)
    } else {
      setProducts(JSON.parse(localProducts))
    }
    
    // Movimientos
    const localMovements = localStorage.getItem('nexus_movements')
    if (!localMovements) {
      localStorage.setItem('nexus_movements', JSON.stringify(INITIAL_MOVEMENTS))
      setMovements(INITIAL_MOVEMENTS)
    } else {
      setMovements(JSON.parse(localMovements))
    }
  }

  // --- MÉTODOS DE DATOS REMOTOS (SUPABASE) ---
  const fetchSupabaseData = async () => {
    setDataLoading(true)
    try {
      // 1. Fetch Categorías
      const { data: cats, error: catError } = await supabase
        .from('categorias')
        .select('*')
        .order('nombre')
      
      if (catError) throw catError
      setCategories(cats || [])

      // 2. Fetch Productos
      const { data: prods, error: prodError } = await supabase
        .from('productos')
        .select('*, categorias(nombre)')
        .order('nombre')
        
      if (prodError) throw prodError
      
      // Mapear para que coincida con la estructura esperada (categorias.nombre -> categoria_nombre)
      const mappedProds = prods.map(p => ({
        ...p,
        categoria_nombre: p.categorias?.nombre
      }))
      setProducts(mappedProds || [])

      // 3. Fetch Movimientos
      const { data: movs, error: movError } = await supabase
        .from('movimientos')
        .select('*, productos(nombre, unidad_medida)')
        .order('creado_en', { ascending: false })
        
      if (movError) throw movError
      
      const mappedMovs = movs.map(m => ({
        ...m,
        producto_nombre: m.productos?.nombre,
        unidad_medida: m.productos?.unidad_medida
      }))
      setMovements(mappedMovs || [])
    } catch (err) {
      showToast('error', `Error al cargar datos: ${err.message}`)
    } finally {
      setDataLoading(false)
    }
  }

  // --- MANEJO DE AUTENTICACION ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthErrorMsg('')
    
    if (!authEmail || !authPassword) {
      setAuthErrorMsg('Completa todos los campos.')
      return
    }

    if (isDemoMode) {
      // Registrar/Iniciar sesión ficticio para Demo
      const demoUser = { id: 'demo-user-123', email: authEmail, nombre: authEmail.split('@')[0] }
      setUser(demoUser)
      localStorage.setItem('nexus_demo_user', JSON.stringify(demoUser))
      showToast('success', `Sesión iniciada como ${demoUser.email} (Demo)`)
    } else {
      setAuthLoading(true)
      try {
        if (isSignUp) {
          const { data, error } = await supabase.auth.signUp({
            email: authEmail,
            password: authPassword
          })
          if (error) throw error
          showToast('success', '¡Registro exitoso! Verifica tu correo electrónico o inicia sesión.')
          setIsSignUp(false)
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password: authPassword
          })
          if (error) throw error
          setUser(data.user)
          showToast('success', 'Sesión iniciada con éxito.')
        }
      } catch (err) {
        setAuthErrorMsg(err.message)
      } finally {
        setAuthLoading(false)
      }
    }
  }

  const handleLogout = async () => {
    if (isDemoMode) {
      setUser(null)
      localStorage.removeItem('nexus_demo_user')
      showToast('success', 'Sesión cerrada.')
    } else {
      await supabase.auth.signOut()
      setUser(null)
      showToast('success', 'Sesión cerrada.')
    }
  }

  const handleBypassAuth = () => {
    // Forzar Modo Demo y loguear automáticamente
    setIsDemoMode(true)
    const demoUser = { id: 'demo-user-123', email: 'chef.demo@nexus.com', nombre: 'Chef Demo' }
    setUser(demoUser)
    localStorage.setItem('nexus_demo_user', JSON.stringify(demoUser))
    showToast('success', 'Modo Demostración Local Activado')
  }

  // --- OPERACIONES: REGISTRAR MOVIMIENTO ---
  const handleRegisterMovement = async (e) => {
    e.preventDefault()
    setMovementError('')
    
    if (!selectedProductForMov || !movementQty || isNaN(movementQty) || parseFloat(movementQty) <= 0 || !movementReason) {
      setMovementError('Por favor ingresa valores válidos y un motivo obligatoriamente.')
      return
    }

    const qty = parseFloat(movementQty)
    const prod = products.find(p => p.id === selectedProductForMov)

    if (!prod) {
      setMovementError('Producto no encontrado.')
      return
    }

    // Prevención temprana en UI para salidas excedentes
    if (movementType === 'Salida' && prod.stock_actual < qty) {
      setMovementError(`Validación UI: Stock insuficiente. Solo hay ${prod.stock_actual} ${prod.unidad_medida} disponibles.`);
      return
    }

    if (isDemoMode) {
      // Simular trigger de base de datos
      const localProds = [...products]
      const index = localProds.findIndex(p => p.id === selectedProductForMov)
      
      if (movementType === 'Salida') {
        if (localProds[index].stock_actual < qty) {
          // Lanzar error como el trigger
          showToast('error', `Error DB Trigger: Stock insuficiente para "${prod.nombre}". Stock actual: ${prod.stock_actual} ${prod.unidad_medida}.`)
          return
        }
        localProds[index].stock_actual -= qty
      } else {
        localProds[index].stock_actual += qty
      }

      // Guardar productos actualizados
      localStorage.setItem('nexus_products', JSON.stringify(localProds))
      setProducts(localProds)

      // Registrar movimiento
      const newMov = {
        id: 'm-' + Math.random().toString(36).substring(2, 9),
        producto_id: selectedProductForMov,
        tipo: movementType,
        cantidad: qty,
        motivo: movementReason,
        usuario_email: user?.email || 'anonimo@nexus.com',
        creado_en: new Date().toISOString(),
        producto_nombre: prod.nombre,
        unidad_medida: prod.unidad_medida
      }

      const localMovs = [newMov, ...movements]
      localStorage.setItem('nexus_movements', JSON.stringify(localMovs))
      setMovements(localMovs)

      showToast('success', `Movimiento registrado: ${movementType} de ${qty} ${prod.unidad_medida}`)
      setShowMovementModal(false)
      resetMovementForm()
    } else {
      // Llamada real a Supabase (el trigger de PostgreSQL validará y actualizará el stock)
      setDataLoading(true)
      try {
        const { error } = await supabase
          .from('movimientos')
          .insert({
            producto_id: selectedProductForMov,
            tipo: movementType,
            cantidad: qty,
            motivo: movementReason,
            usuario_email: user?.email
          })
          
        if (error) {
          // El error del trigger de Postgres vendrá aquí
          throw error
        }

        showToast('success', `Movimiento registrado en Supabase exitosamente.`)
        setShowMovementModal(false)
        resetMovementForm()
        await fetchSupabaseData() // Recargar datos frescos
      } catch (err) {
        setMovementError(err.message || 'Error al guardar en la base de datos.')
        showToast('error', err.message || 'Error de base de datos')
      } finally {
        setDataLoading(false)
      }
    }
  }

  const resetMovementForm = () => {
    setMovementQty('')
    setMovementReason('')
    setMovementError('')
  }

  // --- OPERACIONES: CREAR PRODUCTO ---
  const handleCreateProduct = async (e) => {
    e.preventDefault()
    setNewProductError('')
    
    if (!newProductName.trim() || !newProductCategory || !newProductMinStock || isNaN(newProductMinStock) || parseFloat(newProductMinStock) < 0) {
      setNewProductError('Completa todos los campos correctamente.')
      return
    }

    const minStock = parseFloat(newProductMinStock)

    if (isDemoMode) {
      // Guardar en local storage
      const newProd = {
        id: 'p-' + Math.random().toString(36).substring(2, 9),
        nombre: newProductName.trim(),
        categoria_id: parseInt(newProductCategory),
        unidad_medida: newProductUnit,
        stock_actual: 0.0, // Obligatorio iniciar en 0 para inmutabilidad directa
        stock_minimo: minStock
      }

      // Validar nombre único
      if (products.some(p => p.nombre.toLowerCase() === newProd.nombre.toLowerCase())) {
        setNewProductError('Ya existe un producto con este nombre.')
        return
      }

      const updatedProds = [...products, newProd]
      localStorage.setItem('nexus_products', JSON.stringify(updatedProds))
      setProducts(updatedProds)
      
      showToast('success', `Producto "${newProd.nombre}" creado exitosamente (Stock inicial: 0).`)
      setShowProductModal(false)
      resetProductForm()
    } else {
      setDataLoading(true)
      try {
        const { error } = await supabase
          .from('productos')
          .insert({
            nombre: newProductName.trim(),
            categoria_id: parseInt(newProductCategory),
            unidad_medida: newProductUnit,
            stock_minimo: minStock
            // stock_actual se inicializa en 0 automáticamente por base de datos
          })
          
        if (error) throw error

        showToast('success', `Producto creado exitosamente en Supabase.`)
        setShowProductModal(false)
        resetProductForm()
        await fetchSupabaseData()
      } catch (err) {
        setNewProductError(err.message)
        showToast('error', err.message)
      } finally {
        setDataLoading(false)
      }
    }
  }

  const resetProductForm = () => {
    setNewProductName('')
    setNewProductMinStock('')
    setNewProductError('')
  }

  // --- UTILS ---
  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => {
      setToast(null)
    }, 5000)
  }

  // Mapear nombres de categorías para renderizado
  const categoryMap = useMemo(() => {
    const map = {}
    categories.forEach(c => {
      map[c.id] = c.nombre
    })
    return map
  }, [categories])

  // --- FILTROS DE PRODUCTOS ---
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.categoria_nombre || categoryMap[p.categoria_id] || '').toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchCategory = selectedCategory === 'All' || 
                            p.categoria_id.toString() === selectedCategory.toString()
                            
      return matchSearch && matchCategory
    })
  }, [products, searchQuery, selectedCategory, categoryMap])

  // --- MÉTRICAS DEL INVENTARIO ---
  const metrics = useMemo(() => {
    let alertCount = 0
    let outCount = 0
    
    products.forEach(p => {
      if (p.stock_actual === 0) {
        outCount++
        alertCount++ // Agotados también están por debajo del mínimo
      } else if (p.stock_actual <= p.stock_minimo) {
        alertCount++
      }
    })
    
    // Movimientos de hoy
    const startOfToday = new Date()
    startOfToday.setHours(0,0,0,0)
    const todayMovements = movements.filter(m => new Date(m.creado_en) >= startOfToday).length

    return {
      total: products.length,
      alerts: alertCount,
      out: outCount,
      today: todayMovements
    }
  }, [products, movements])

  // Productos únicamente en alerta para la lista de compras
  const alertProducts = useMemo(() => {
    return products.filter(p => p.stock_actual <= p.stock_minimo)
  }, [products])

  // Copiar lista de compras
  const copyShoppingList = () => {
    const text = alertProducts.map(p => {
      const faltante = Math.max(0, p.stock_minimo - p.stock_actual)
      const catName = p.categoria_nombre || categoryMap[p.categoria_id] || 'General'
      return `- [${catName}] ${p.nombre}: Stock Actual: ${p.stock_actual} ${p.unidad_medida} | Mínimo: ${p.stock_minimo} ${p.unidad_medida} (Faltante: ${faltante} ${p.unidad_medida})`
    }).join('\n')

    navigator.clipboard.writeText(text)
    showToast('success', 'Lista de compras copiada al portapapeles.')
  }

  // --- VISTA DE CARGA INICIAL ---
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium">Iniciando sistema NEXUS...</p>
      </div>
    )
  }

  // --- PANTALLA DE ACCESO (LOGIN) ---
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        {/* Toast Notificación */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 glass px-6 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-slide-up ${
            toast.type === 'error' ? 'border-red-500/40 text-red-400' : 'border-emerald-500/40 text-emerald-400'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
            <p className="text-sm font-semibold">{toast.message}</p>
          </div>
        )}

        {/* Card de Login */}
        <div className="w-full max-w-md glass rounded-3xl p-8 shadow-2xl border border-white/5 relative overflow-hidden animate-slide-up">
          {/* Fondo decorativo interno */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl"></div>

          <div className="relative z-10 text-center mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              NEXUS
            </h1>
            <p className="text-gray-400 text-sm mt-1">Gestión de Inventario Alimenticio</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-5 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Correo Electrónico</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="chef@nexus.com"
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Contraseña</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm"
              />
            </div>

            {authErrorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-400">
                {authErrorMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 transform hover:-translate-y-0.5"
            >
              {isSignUp ? 'Registrarse' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="relative z-10 flex flex-col items-center mt-6 space-y-4">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-gray-400 hover:text-white transition-all underline"
            >
              {isSignUp ? '¿Ya tienes una cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate'}
            </button>

            <div className="w-full flex items-center justify-between py-2">
              <div className="w-full h-px bg-white/5"></div>
              <span className="text-[10px] uppercase font-bold text-gray-600 px-3 tracking-widest">O</span>
              <div className="w-full h-px bg-white/5"></div>
            </div>

            <button
              onClick={handleBypassAuth}
              className="w-full py-3 bg-slate-800/60 border border-white/5 hover:bg-slate-700/60 text-slate-300 font-semibold rounded-xl text-sm transition-all hover:text-white flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Modo Demostración (Local)</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- VISTA DASHBOARD PRINCIPAL ---
  return (
    <div className="min-h-screen flex flex-col pb-12">
      {/* Toast Notificación */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 glass px-6 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-slide-up ${
          toast.type === 'error' ? 'border-red-500/40 text-red-400' : 'border-emerald-500/40 text-emerald-400'
        }`}>
          <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
          <p className="text-sm font-semibold">{toast.message}</p>
        </div>
      )}

      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
            NEXUS
          </span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
            isDemoMode 
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {isDemoMode ? '💾 Modo Demo Local' : '⚡ Supabase Conectado'}
          </span>
        </div>

        <div className="flex items-center space-x-6">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs text-gray-400">Usuario Activo</span>
            <span className="text-sm font-medium text-gray-200">{user.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 hover:text-red-400 text-gray-300 font-semibold rounded-lg text-xs transition-all border border-white/5"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex-1">
        
        {/* Sección de Métricas */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-2xl p-6 relative overflow-hidden transition-all hover:scale-[1.02] border border-white/5">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Total Insumos</span>
            <span className="text-4xl font-extrabold text-white mt-2 block">{metrics.total}</span>
            <div className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 relative overflow-hidden transition-all hover:scale-[1.02] border border-white/5">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Bajo Stock (Alerta)</span>
            <span className="text-4xl font-extrabold text-amber-400 mt-2 block">{metrics.alerts}</span>
            <div className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 relative overflow-hidden transition-all hover:scale-[1.02] border border-white/5">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Insumos Agotados</span>
            <span className="text-4xl font-extrabold text-red-500 mt-2 block">{metrics.out}</span>
            <div className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 relative overflow-hidden transition-all hover:scale-[1.02] border border-white/5">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Movimientos (Hoy)</span>
            <span className="text-4xl font-extrabold text-indigo-400 mt-2 block">{metrics.today}</span>
            <div className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
          </div>
        </section>

        {/* Selector de Pestañas */}
        <div className="flex border-b border-white/5 mb-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-4 px-6 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'dashboard' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Insumos</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-gray-300 font-bold">{products.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('alertas')}
            className={`py-4 px-6 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'alertas' 
                ? 'border-amber-500 text-amber-400' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Alertas de Reabastecimiento</span>
            {metrics.alerts > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-[10px] text-amber-400 border border-amber-500/20 font-bold animate-pulse">
                {metrics.alerts}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('historial')}
            className={`py-4 px-6 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'historial' 
                ? 'border-purple-500 text-purple-400' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Auditoría de Movimientos</span>
          </button>
        </div>

        {/* TAB 1: INSUMOS (DASHBOARD) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            {/* Buscador, Filtros y Acciones */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-1 flex-col sm:flex-row gap-3">
                {/* Buscador */}
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar insumo o categoría..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm"
                  />
                  <div className="absolute left-3 top-3 text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Filtro por Categorías */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-sm cursor-pointer"
                >
                  <option value="All">Todas las Categorías</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Botón Nuevo Insumo */}
              <button
                onClick={() => setShowProductModal(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Nuevo Insumo</span>
              </button>
            </div>

            {/* Listado de Productos */}
            <div className="glass rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
              {dataLoading ? (
                <div className="p-12 text-center text-gray-400 font-medium space-y-3">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p>Cargando información del almacén...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-16 text-center text-gray-500 font-medium">
                  No se encontraron insumos con los filtros aplicados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-slate-900/40 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="px-6 py-4">Insumo</th>
                        <th className="px-6 py-4">Categoría</th>
                        <th className="px-6 py-4 text-right">Stock Mínimo</th>
                        <th className="px-6 py-4 text-right">Stock Actual</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredProducts.map(p => {
                        const isOut = p.stock_actual === 0
                        const isAlert = p.stock_actual <= p.stock_minimo
                        const catName = p.categoria_nombre || categoryMap[p.categoria_id] || 'General'
                        
                        return (
                          <tr key={p.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="px-6 py-4 font-semibold text-white">{p.nombre}</td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-xs text-gray-400 font-medium">
                                {catName}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-gray-400 font-medium">
                              {p.stock_minimo} <span className="text-[10px] text-gray-500">{p.unidad_medida}</span>
                            </td>
                            <td className={`px-6 py-4 text-right font-extrabold text-sm ${
                              isOut ? 'text-red-500' : isAlert ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              {p.stock_actual} <span className="text-[10px] font-semibold text-gray-500">{p.unidad_medida}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                isOut 
                                  ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                                  : isAlert 
                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full bg-current ${isOut ? 'animate-ping' : ''}`}></span>
                                <span>{isOut ? 'Agotado' : isAlert ? 'Reabastecer' : 'Suficiente'}</span>
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="inline-flex items-center space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedProductForMov(p.id)
                                    setMovementType('Entrada')
                                    setShowMovementModal(true)
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-bold text-xs transition-all flex items-center space-x-1"
                                >
                                  <span>+</span> <span>Entrada</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedProductForMov(p.id)
                                    setMovementType('Salida')
                                    setShowMovementModal(true)
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-xs transition-all flex items-center space-x-1 ${isOut ? 'opacity-40 cursor-not-allowed' : ''}`}
                                  disabled={isOut}
                                >
                                  <span>-</span> <span>Salida</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ALERTAS DE REABASTECIMIENTO */}
        {activeTab === 'alertas' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Lista de Reabastecimiento</h2>
                <p className="text-sm text-gray-400">Todos los insumos por debajo del umbral mínimo de seguridad.</p>
              </div>
              {alertProducts.length > 0 && (
                <button
                  onClick={copyShoppingList}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/5 text-gray-200 font-semibold rounded-xl text-xs transition-all flex items-center space-x-2"
                >
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>Copiar Lista de Compras</span>
                </button>
              )}
            </div>

            <div className="glass rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
              {alertProducts.length === 0 ? (
                <div className="p-16 text-center text-emerald-400 font-medium space-y-2">
                  <svg className="w-12 h-12 mx-auto text-emerald-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg">Todo al día</p>
                  <p className="text-xs text-gray-400">No hay insumos bajo el umbral mínimo de stock.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-slate-900/40 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="px-6 py-4">Insumo</th>
                        <th className="px-6 py-4">Categoría</th>
                        <th className="px-6 py-4 text-right">Stock Mínimo</th>
                        <th className="px-6 py-4 text-right">Stock Actual</th>
                        <th className="px-6 py-4 text-right">Faltante Estimado</th>
                        <th className="px-6 py-4 text-center">Gravedad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {alertProducts.map(p => {
                        const isOut = p.stock_actual === 0
                        const deficit = Math.max(0, p.stock_minimo - p.stock_actual)
                        const catName = p.categoria_nombre || categoryMap[p.categoria_id] || 'General'
                        
                        return (
                          <tr key={p.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="px-6 py-4 font-semibold text-white">{p.nombre}</td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-xs text-gray-400 font-medium">
                                {catName}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-gray-400 font-medium">
                              {p.stock_minimo} <span className="text-[10px] text-gray-500">{p.unidad_medida}</span>
                            </td>
                            <td className={`px-6 py-4 text-right font-extrabold text-sm ${
                              isOut ? 'text-red-500' : 'text-amber-400'
                            }`}>
                              {p.stock_actual} <span className="text-[10px] font-semibold text-gray-500">{p.unidad_medida}</span>
                            </td>
                            <td className="px-6 py-4 text-right font-extrabold text-blue-400 text-sm">
                              {deficit} <span className="text-[10px] font-semibold text-gray-500">{p.unidad_medida}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                isOut 
                                  ? 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse' 
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                <span>{isOut ? 'Crítico (Agotado)' : 'Advertencia (Bajo)'}</span>
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: HISTORIAL DE MOVIMIENTOS (AUDITORÍA) */}
        {activeTab === 'historial' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-white">Registro de Auditoría</h2>
              <p className="text-sm text-gray-400">Historial completo e inmutable de entradas y salidas de inventario.</p>
            </div>

            <div className="glass rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
              {movements.length === 0 ? (
                <div className="p-16 text-center text-gray-500 font-medium">
                  Aún no se han registrado movimientos de inventario.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-slate-900/40 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="px-6 py-4">Fecha y Hora</th>
                        <th className="px-6 py-4">Insumo</th>
                        <th className="px-6 py-4 text-center">Operación</th>
                        <th className="px-6 py-4 text-right">Cantidad</th>
                        <th className="px-6 py-4">Usuario Responsable</th>
                        <th className="px-6 py-4">Motivo / Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {movements.map(m => {
                        const date = new Date(m.creado_en)
                        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        const isSalida = m.tipo === 'Salida'
                        const prodName = m.producto_nombre || (products.find(p => p.id === m.producto_id)?.nombre) || 'Desconocido'
                        const unit = m.unidad_medida || (products.find(p => p.id === m.producto_id)?.unidad_medida) || ''
                        
                        return (
                          <tr key={m.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="px-6 py-4 text-xs font-semibold text-gray-400 whitespace-nowrap">{formattedDate}</td>
                            <td className="px-6 py-4 font-semibold text-white">{prodName}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                isSalida 
                                  ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {isSalida ? 'Salida (-)' : 'Entrada (+)'}
                              </span>
                            </td>
                            <td className={`px-6 py-4 text-right font-extrabold text-sm ${
                              isSalida ? 'text-red-400' : 'text-emerald-400'
                            }`}>
                              {isSalida ? '-' : '+'}{m.cantidad} <span className="text-[10px] font-semibold text-gray-500">{unit}</span>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-gray-300">
                              {m.usuario_email || 'anonimo@nexus.com'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-400 italic max-w-xs truncate" title={m.motivo}>
                              {m.motivo}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* --- MODAL: REGISTRAR MOVIMIENTO --- */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass rounded-3xl p-6 border border-white/10 shadow-2xl relative animate-slide-up">
            <h3 className="text-xl font-bold text-white mb-4">
              Registrar {movementType === 'Entrada' ? 'Entrada (+)' : 'Salida (-)'}
            </h3>

            {selectedProductForMov && (
              <div className="mb-4 p-3 bg-slate-900/60 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">Insumo</span>
                  <span className="text-sm font-bold text-white">
                    {products.find(p => p.id === selectedProductForMov)?.nombre}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">Stock Disponible</span>
                  <span className="text-sm font-bold text-blue-400">
                    {products.find(p => p.id === selectedProductForMov)?.stock_actual} {products.find(p => p.id === selectedProductForMov)?.unidad_medida}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleRegisterMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cantidad</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={movementQty}
                    onChange={(e) => setMovementQty(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm"
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-gray-500">
                    {products.find(p => p.id === selectedProductForMov)?.unidad_medida}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Motivo / Justificación</label>
                <textarea
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder={movementType === 'Entrada' ? 'Ej: Recepción del proveedor, Factura #101' : 'Ej: Mermas, preparación de 150 almuerzos'}
                  rows="3"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              {movementError && (
                <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-400">
                  {movementError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMovementModal(false)
                    resetMovementForm()
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-gray-300 font-semibold text-xs transition-all border border-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl text-white font-semibold text-xs transition-all shadow-lg flex items-center space-x-2 ${
                    movementType === 'Entrada' 
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' 
                      : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                  }`}
                >
                  <span>Registrar Movimiento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: NUEVO INSUMO --- */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass rounded-3xl p-6 border border-white/10 shadow-2xl relative animate-slide-up">
            <h3 className="text-xl font-bold text-white mb-4">
              Registrar Nuevo Insumo
            </h3>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nombre del Insumo</label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Ej: Harina de Trigo, Carne Molida"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Categoría</label>
                  <select
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-sm cursor-pointer"
                  >
                    <option value="">Seleccionar...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Unidad de Medida</label>
                  <select
                    value={newProductUnit}
                    onChange={(e) => setNewProductUnit(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-sm cursor-pointer"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="litros">litros</option>
                    <option value="ml">ml</option>
                    <option value="unidades">unidades</option>
                    <option value="paquetes">paquetes</option>
                    <option value="cajas">cajas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Stock Mínimo (Umbral)</label>
                <input
                  type="number"
                  step="any"
                  value={newProductMinStock}
                  onChange={(e) => setNewProductMinStock(e.target.value)}
                  placeholder="Ej: 10.00"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-xl text-[11px] text-blue-400 flex items-start space-x-2">
                <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Por regla de negocio, el stock inicial se crea en **0**. Deberás registrar un movimiento de entrada para subir el stock de este nuevo insumo.</span>
              </div>

              {newProductError && (
                <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-400">
                  {newProductError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProductModal(false)
                    resetProductForm()
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-gray-300 font-semibold text-xs transition-all border border-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-900/20"
                >
                  Crear Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
