import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'

// --- SEED LOCAL DEMO DATA (Por si no hay conexión a Supabase o falta configurar) ---
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
  { id: 'p5', nombre: 'Tomate', categoria_id: 3, unidad_medida: 'kg', stock_actual: 5.0, stock_minimo: 8.0 }, // Bajo stock
  { id: 'p6', nombre: 'Cebolla Cabezoña', categoria_id: 3, unidad_medida: 'kg', stock_actual: 35.0, stock_minimo: 8.0 },
  { id: 'p7', nombre: 'Queso Doble Crema', categoria_id: 4, unidad_medida: 'kg', stock_actual: 2.0, stock_minimo: 5.0 }, // Bajo stock
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
  // --- TEMA DUAL ---
  const [theme, setTheme] = useState(() => localStorage.getItem('nexus_theme') || 'dark')

  useEffect(() => {
    localStorage.setItem('nexus_theme', theme)
    const root = window.document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

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
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' | 'alertas' | 'historial'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  
  // Modales / Bottom Sheets
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [selectedProductForMov, setSelectedProductForMov] = useState(null)
  const [movementType, setMovementType] = useState('Entrada') // 'Entrada' | 'Salida'
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
  const [toast, setToast] = useState(null)

  // Formulario Auth
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [authErrorMsg, setAuthErrorMsg] = useState('')

  // --- DETECCION DE CREDENCIALES ---
  useEffect(() => {
    const checkSupabaseConfig = async () => {
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      const isPlaceholder = 
        !url || 
        !key || 
        url.includes('REEMPLAZAR') || 
        key.includes('REEMPLAZAR') ||
        url.includes('TU_PROYECTO_SUPABASE') ||
        key.includes('TU_API_KEY_ANON_DE_SUPABASE')
        
      if (isPlaceholder) {
        setIsDemoMode(true)
        setSupabaseConnected(false)
        setAuthLoading(false)
        loadLocalData()
        
        const savedDemoUser = localStorage.getItem('nexus_demo_user')
        if (savedDemoUser) {
          setUser(JSON.parse(savedDemoUser))
        }
      } else {
        try {
          setIsDemoMode(false)
          setSupabaseConnected(true)
          
          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
              setUser(session.user)
            } else {
              setUser(null)
            }
            setAuthLoading(false)
          })
          
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
          console.error("Error conectando a Supabase, cayendo a modo Demo:", e)
          setIsDemoMode(true)
          setSupabaseConnected(false)
          setAuthLoading(false)
          loadLocalData()
        }
      }
    }
    
    checkSupabaseConfig()
  }, [])

  useEffect(() => {
    if (isDemoMode) {
      loadLocalData()
    } else if (user) {
      fetchSupabaseData()
    }
  }, [user, isDemoMode])

  // --- LOCAL STORAGE ---
  const loadLocalData = () => {
    setCategories(INITIAL_CATEGORIES)
    
    const localProducts = localStorage.getItem('nexus_products')
    if (!localProducts) {
      localStorage.setItem('nexus_products', JSON.stringify(INITIAL_PRODUCTS))
      setProducts(INITIAL_PRODUCTS)
    } else {
      setProducts(JSON.parse(localProducts))
    }
    
    const localMovements = localStorage.getItem('nexus_movements')
    if (!localMovements) {
      localStorage.setItem('nexus_movements', JSON.stringify(INITIAL_MOVEMENTS))
      setMovements(INITIAL_MOVEMENTS)
    } else {
      setMovements(JSON.parse(localMovements))
    }
  }

  // --- SUPABASE CLIENT ---
  const fetchSupabaseData = async () => {
    setDataLoading(true)
    try {
      const { data: cats, error: catError } = await supabase
        .from('categorias')
        .select('*')
        .order('nombre')
      
      if (catError) throw catError
      setCategories(cats || [])

      const { data: prods, error: prodError } = await supabase
        .from('productos')
        .select('*, categorias(nombre)')
        .order('nombre')
        
      if (prodError) throw prodError
      
      const mappedProds = prods.map(p => ({
        ...p,
        categoria_nombre: p.categorias?.nombre
      }))
      setProducts(mappedProds || [])

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
      showToast('error', `Error de carga: ${err.message}`)
    } finally {
      setDataLoading(false)
    }
  }

  // --- AUTENTICACION ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthErrorMsg('')
    
    if (!authEmail || !authPassword) {
      setAuthErrorMsg('Ingresa correo y contraseña.')
      return
    }

    if (isDemoMode) {
      const demoUser = { id: 'demo-user-123', email: authEmail, nombre: authEmail.split('@')[0] }
      setUser(demoUser)
      localStorage.setItem('nexus_demo_user', JSON.stringify(demoUser))
      showToast('success', `Sesión iniciada (Demo)`)
    } else {
      setAuthLoading(true)
      try {
        if (isSignUp) {
          const { error } = await supabase.auth.signUp({
            email: authEmail,
            password: authPassword
          })
          if (error) throw error
          showToast('success', '¡Registro exitoso! Confirma tu correo o inicia sesión.')
          setIsSignUp(false)
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password: authPassword
          })
          if (error) throw error
          setUser(data.user)
          showToast('success', 'Sesión iniciada.')
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
    setIsDemoMode(true)
    const demoUser = { id: 'demo-user-123', email: 'chef.demo@nexus.com', nombre: 'Chef Demo' }
    setUser(demoUser)
    localStorage.setItem('nexus_demo_user', JSON.stringify(demoUser))
    showToast('success', 'Modo Demostración Local Activado')
  }

  // --- REGISTRAR MOVIMIENTO (Trigger local / remoto) ---
  const handleRegisterMovement = async (e) => {
    e.preventDefault()
    setMovementError('')
    
    if (!selectedProductForMov || !movementQty || isNaN(movementQty) || parseFloat(movementQty) <= 0 || !movementReason) {
      setMovementError('Ingresa una cantidad y motivo obligatorios.')
      return
    }

    const qty = parseFloat(movementQty)
    const prod = products.find(p => p.id === selectedProductForMov)

    if (!prod) {
      setMovementError('Insumo no encontrado.')
      return
    }

    if (movementType === 'Salida' && prod.stock_actual < qty) {
      setMovementError(`Validación: Stock insuficiente. Solo hay ${prod.stock_actual} ${prod.unidad_medida} disponibles.`);
      return
    }

    if (isDemoMode) {
      const localProds = [...products]
      const index = localProds.findIndex(p => p.id === selectedProductForMov)
      
      if (movementType === 'Salida') {
        if (localProds[index].stock_actual < qty) {
          showToast('error', `Trigger: Stock insuficiente para "${prod.nombre}".`)
          return
        }
        localProds[index].stock_actual -= qty
      } else {
        localProds[index].stock_actual += qty
      }

      localStorage.setItem('nexus_products', JSON.stringify(localProds))
      setProducts(localProds)

      const newMov = {
        id: 'm-' + Math.random().toString(36).substring(2, 9),
        producto_id: selectedProductForMov,
        tipo: movementType,
        cantidad: qty,
        motivo: movementReason,
        usuario_email: user?.email || 'chef.demo@nexus.com',
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
          
        if (error) throw error

        showToast('success', 'Movimiento registrado en Supabase.')
        setShowMovementModal(false)
        resetMovementForm()
        await fetchSupabaseData()
      } catch (err) {
        setMovementError(err.message)
        showToast('error', err.message)
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

  // --- NUEVO INSUMO ---
  const handleCreateProduct = async (e) => {
    e.preventDefault()
    setNewProductError('')
    
    if (!newProductName.trim() || !newProductCategory || !newProductMinStock || isNaN(newProductMinStock) || parseFloat(newProductMinStock) < 0) {
      setNewProductError('Completa todos los campos obligatorios.')
      return
    }

    const minStock = parseFloat(newProductMinStock)

    if (isDemoMode) {
      const newProd = {
        id: 'p-' + Math.random().toString(36).substring(2, 9),
        nombre: newProductName.trim(),
        categoria_id: parseInt(newProductCategory),
        unidad_medida: newProductUnit,
        stock_actual: 0.0,
        stock_minimo: minStock
      }

      if (products.some(p => p.nombre.toLowerCase() === newProd.nombre.toLowerCase())) {
        setNewProductError('Ya existe un insumo con este nombre.')
        return
      }

      const updatedProds = [...products, newProd]
      localStorage.setItem('nexus_products', JSON.stringify(updatedProds))
      setProducts(updatedProds)
      
      showToast('success', `Insumo "${newProd.nombre}" creado (Stock: 0).`)
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
          })
          
        if (error) throw error

        showToast('success', `Insumo creado en Supabase.`)
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

  // --- NOTIFICACIONES ---
  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  // --- MAPEO DE CATEGORIAS ---
  const categoryMap = useMemo(() => {
    const map = {}
    categories.forEach(c => { map[c.id] = c.nombre })
    return map
  }, [categories])

  // --- FILTROS ---
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const catName = p.categoria_nombre || categoryMap[p.categoria_id] || ''
      const matchSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          catName.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchCategory = selectedCategory === 'All' || 
                            p.categoria_id.toString() === selectedCategory.toString()
                            
      return matchSearch && matchCategory
    })
  }, [products, searchQuery, selectedCategory, categoryMap])

  // --- METRICAS ---
  const metrics = useMemo(() => {
    let alertCount = 0
    let outCount = 0
    
    products.forEach(p => {
      if (p.stock_actual === 0) {
        outCount++
        alertCount++
      } else if (p.stock_actual <= p.stock_minimo) {
        alertCount++
      }
    })
    
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

  const alertProducts = useMemo(() => {
    return products.filter(p => p.stock_actual <= p.stock_minimo)
  }, [products])

  const copyShoppingList = () => {
    const text = alertProducts.map(p => {
      const faltante = Math.max(0, p.stock_minimo - p.stock_actual)
      const catName = p.categoria_nombre || categoryMap[p.categoria_id] || 'General'
      return `- [${catName}] ${p.nombre}: Stock: ${p.stock_actual} / Min: ${p.stock_minimo} ${p.unidad_medida} (Falta: ${faltante})`
    }).join('\n')

    navigator.clipboard.writeText(text)
    showToast('success', 'Lista de compras copiada.')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col space-y-4 bg-brand-bg text-brand-text">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold tracking-wide text-brand-muted">Cargando inventario Nexus...</p>
      </div>
    )
  }

  // --- PANTALLA DE ACCESO (LOGIN) ---
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-brand-bg text-brand-text transition-colors duration-300">
        
        {/* Toggle de Tema flotante en el login */}
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-3 rounded-full glass hover:scale-110 active:scale-95 transition-all text-xl cursor-pointer"
          title="Cambiar Tema"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {toast && (
          <div className={`fixed top-4 right-4 z-50 glass px-6 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-slide-up ${
            toast.type === 'error' ? 'border-red-500/40 text-red-400' : 'border-emerald-500/40 text-emerald-400'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
            <p className="text-xs font-bold">{toast.message}</p>
          </div>
        )}

        {/* Card de Acceso estilo App Móvil */}
        <div className="w-full max-w-sm glass rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden animate-slide-up soft-shadow border border-brand-border">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-500/10 rounded-3xl mx-auto flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent">
              NEXUS
            </h1>
            <p className="text-brand-muted text-xs mt-1 font-semibold">Sistema de Inventario Móvil</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-1.5 ml-1">Correo Electrónico</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="usuario@nexus.com"
                className="w-full px-4 py-3 rounded-2xl bg-brand-bg border border-brand-border text-brand-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all text-sm h-12"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-1.5 ml-1">Contraseña</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-2xl bg-brand-bg border border-brand-border text-brand-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all text-sm h-12"
              />
            </div>

            {authErrorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                {authErrorMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-sm transition-all shadow-md shadow-blue-500/10 active:scale-98 cursor-pointer"
            >
              {isSignUp ? 'Registrarse en Nexus' : 'Ingresar'}
            </button>
          </form>

          <div className="flex flex-col items-center mt-6 space-y-4">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-brand-muted hover:text-brand-text transition-all underline"
            >
              {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Crea una'}
            </button>

            <div className="w-full flex items-center justify-between py-1">
              <div className="w-full h-px bg-brand-border"></div>
              <span className="text-[9px] uppercase font-black text-brand-muted px-3 tracking-widest">O</span>
              <div className="w-full h-px bg-brand-border"></div>
            </div>

            <button
              onClick={handleBypassAuth}
              className="w-full h-12 bg-slate-500/10 border border-brand-border hover:bg-slate-500/20 text-brand-text font-bold rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Acceder como Demo Local</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- VISTA DASHBOARD PRINCIPAL ---
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col pb-24 md:pb-8 transition-colors duration-300">
      
      {/* Toast Notificación */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-6 right-4 z-50 glass px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-2 animate-slide-up ${
          toast.type === 'error' ? 'border-red-500/40 text-red-400' : 'border-emerald-500/40 text-emerald-400'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
          <p className="text-xs font-bold">{toast.message}</p>
        </div>
      )}

      {/* Header Premium (Ergonómico) */}
      <header className="glass-header sticky top-0 z-30 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent block">
              NEXUS
            </span>
            <span className="text-[8px] font-black text-brand-muted uppercase tracking-wider block -mt-1">
              {isDemoMode ? 'Demostración' : 'Supabase Activo'}
            </span>
          </div>
        </div>

        {/* Acciones del Header */}
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl glass hover:scale-105 active:scale-95 text-sm transition-all cursor-pointer"
            title="Cambiar Modo"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          
          <div className="hidden md:flex flex-col text-right text-xs">
            <span className="text-[10px] text-brand-muted font-bold">Chef Activo</span>
            <span className="font-semibold">{user.email.split('@')[0]}</span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-semibold cursor-pointer"
            title="Cerrar Sesión"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Cuerpo Principal */}
      <main className="max-w-4xl w-full mx-auto px-4 pt-6 flex-1">
        
        {/* Sección de Métricas (Formato Circular Redondeado de la Referencia) */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
          <div className="glass rounded-[1.8rem] p-4.5 relative overflow-hidden transition-all hover:scale-[1.01]">
            <span className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">Insumos</span>
            <span className="text-3xl font-extrabold text-brand-text mt-1 block">{metrics.total}</span>
            <span className="text-[9px] text-brand-muted block mt-0.5 font-medium">Registrados</span>
          </div>

          <div className="glass rounded-[1.8rem] p-4.5 relative overflow-hidden transition-all hover:scale-[1.01]">
            <span className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">Reabastecer</span>
            <span className="text-3xl font-extrabold text-amber-500 mt-1 block">{metrics.alerts}</span>
            <span className="text-[9px] text-amber-500/80 block mt-0.5 font-semibold animate-pulse">Bajo Mínimo</span>
          </div>

          <div className="glass rounded-[1.8rem] p-4.5 relative overflow-hidden transition-all hover:scale-[1.01]">
            <span className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">Agotado</span>
            <span className="text-3xl font-extrabold text-red-500 mt-1 block">{metrics.out}</span>
            <span className="text-[9px] text-red-500/80 block mt-0.5 font-semibold">Stock Cero</span>
          </div>

          <div className="glass rounded-[1.8rem] p-4.5 relative overflow-hidden transition-all hover:scale-[1.01]">
            <span className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">Operaciones</span>
            <span className="text-3xl font-extrabold text-blue-500 mt-1 block">{metrics.today}</span>
            <span className="text-[9px] text-brand-muted block mt-0.5 font-medium">Registradas hoy</span>
          </div>
        </section>

        {/* Pestanas en Pantallas Grandes (Desktop tabs) */}
        <div className="hidden md:flex border-b border-brand-border mb-6">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-3 px-5 text-xs font-bold border-b-2 tracking-wide transition-all ${
              activeTab === 'dashboard' ? 'border-blue-500 text-blue-500' : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            Almacén ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('alertas')}
            className={`py-3 px-5 text-xs font-bold border-b-2 tracking-wide transition-all ${
              activeTab === 'alertas' ? 'border-amber-500 text-amber-500' : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            Lista de Compras ({metrics.alerts})
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`py-3 px-5 text-xs font-bold border-b-2 tracking-wide transition-all ${
              activeTab === 'historial' ? 'border-purple-500 text-purple-500' : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            Auditoría
          </button>
        </div>

        {/* TAB 1: ALMACÉN (DASHBOARD) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5 animate-fade-in">
            {/* Controles de Búsqueda y Creación */}
            <div className="space-y-3">
              {/* Caja de Búsqueda Móvil */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por insumo..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-brand-card border border-brand-border text-brand-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all text-sm"
                />
                <div className="absolute left-3.5 top-3.5 text-brand-muted">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Pills de Categoría Deslizables Horizontalmente (Ergonómico para celular) */}
              <div className="flex overflow-x-auto pb-1.5 gap-2 scrollbar-none snap-x snap-mandatory">
                <button
                  onClick={() => setSelectedCategory('All')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 snap-start transition-all cursor-pointer ${
                    selectedCategory === 'All'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                      : 'glass text-brand-muted hover:text-brand-text'
                  }`}
                >
                  Todos
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 snap-start transition-all cursor-pointer ${
                      selectedCategory.toString() === cat.id.toString()
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                        : 'glass text-brand-muted hover:text-brand-text'
                    }`}
                  >
                    {cat.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Listado en Tarjetas Responsivas (Estilo Screen 3 de la referencia) */}
            <div className="space-y-3.5">
              {dataLoading ? (
                <div className="py-12 text-center text-brand-muted font-medium flex flex-col items-center justify-center space-y-2">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs">Sincronizando inventario...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-brand-muted text-xs glass rounded-3xl">
                  No hay insumos registrados.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredProducts.map(p => {
                    const isOut = p.stock_actual === 0
                    const isAlert = p.stock_actual <= p.stock_minimo
                    const catName = p.categoria_nombre || categoryMap[p.categoria_id] || 'General'
                    
                    return (
                      <div
                        key={p.id}
                        className="glass rounded-3xl p-5 border border-brand-border flex flex-col justify-between hover:scale-[1.01] transition-transform duration-200 relative overflow-hidden"
                      >
                        {/* Indicador de Alerta Extremo */}
                        {isOut && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500 animate-pulse"></div>}
                        {!isOut && isAlert && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>}

                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[9px] font-black uppercase text-brand-muted tracking-wider block mb-1">
                              {catName}
                            </span>
                            <h3 className="text-base font-extrabold tracking-tight text-brand-text leading-tight">
                              {p.nombre}
                            </h3>
                          </div>
                          
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            isOut 
                              ? 'bg-red-500/10 text-red-500 border border-red-500/10' 
                              : isAlert 
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/10' 
                                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10'
                          }`}>
                            {isOut ? 'Agotado' : isAlert ? 'Bajo' : 'Suficiente'}
                          </span>
                        </div>

                        {/* Detalle Stock Visual Grande */}
                        <div className="my-4.5 flex items-baseline justify-between border-t border-b border-brand-border/40 py-2.5">
                          <div>
                            <span className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">Min. Control</span>
                            <span className="text-xs font-semibold text-brand-muted">
                              {p.stock_minimo} <span className="text-[10px] font-normal">{p.unidad_medida}</span>
                            </span>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[9px] text-brand-muted font-bold uppercase tracking-wider block">Stock Disponible</span>
                            <span className={`text-xl font-black ${
                              isOut ? 'text-red-500' : isAlert ? 'text-amber-500' : 'text-emerald-500'
                            }`}>
                              {p.stock_actual} <span className="text-xs font-medium text-brand-muted">{p.unidad_medida}</span>
                            </span>
                          </div>
                        </div>

                        {/* Botones de Acción Ergonómicos e Inmutables */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedProductForMov(p.id)
                              setMovementType('Entrada')
                              setShowMovementModal(true)
                            }}
                            className="flex-1 h-10 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-xs font-bold tracking-wider transition-all flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <span>+ Entrada</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedProductForMov(p.id)
                              setMovementType('Salida')
                              setShowMovementModal(true)
                            }}
                            className={`flex-1 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-xs font-bold tracking-wider transition-all flex items-center justify-center space-x-1 cursor-pointer ${isOut ? 'opacity-40 cursor-not-allowed' : ''}`}
                            disabled={isOut}
                          >
                            <span>- Salida</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ALERTAS (LISTA DE COMPRAS) */}
        {activeTab === 'alertas' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Abastecimiento Requerido</h2>
                <p className="text-[10px] text-brand-muted font-semibold tracking-wide uppercase mt-0.5">Generador Automático de Pedido</p>
              </div>
              
              {alertProducts.length > 0 && (
                <button
                  onClick={copyShoppingList}
                  className="px-3.5 py-2 glass hover:bg-brand-border border border-brand-border text-brand-text font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Copiar Pedido</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {alertProducts.length === 0 ? (
                <div className="py-16 text-center text-brand-text font-semibold text-sm glass rounded-3xl flex flex-col items-center justify-center space-y-2">
                  <span className="text-3xl">🎉</span>
                  <p>¡Inventario al día!</p>
                  <p className="text-[10px] text-brand-muted font-normal">Todos los insumos se encuentran por encima del mínimo.</p>
                </div>
              ) : (
                alertProducts.map(p => {
                  const isOut = p.stock_actual === 0
                  const deficit = Math.max(0, p.stock_minimo - p.stock_actual)
                  const catName = p.categoria_nombre || categoryMap[p.categoria_id] || 'General'
                  
                  return (
                    <div
                      key={p.id}
                      className="glass rounded-2.5xl p-4 border border-brand-border flex items-center justify-between relative overflow-hidden"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${isOut ? 'bg-red-500 animate-ping' : 'bg-amber-500'}`}></div>
                        <div>
                          <span className="text-[8px] font-bold text-brand-muted block uppercase tracking-wider">{catName}</span>
                          <h4 className="text-sm font-extrabold text-brand-text leading-tight">{p.nombre}</h4>
                          <span className="text-[10px] text-brand-muted font-medium">
                            Stock: {p.stock_actual} / Mínimo: {p.stock_minimo} {p.unidad_medida}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[8px] font-black text-blue-500 block uppercase tracking-wider">Faltante</span>
                        <span className="text-lg font-black text-blue-500">
                          {deficit} <span className="text-xs font-semibold text-brand-muted">{p.unidad_medida}</span>
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: AUDITORÍA DE MOVIMIENTOS */}
        {activeTab === 'historial' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Bitácora de Auditoría</h2>
              <p className="text-[10px] text-brand-muted font-semibold tracking-wide uppercase mt-0.5">Historial Inmutable de Operaciones</p>
            </div>

            <div className="space-y-3.5">
              {movements.length === 0 ? (
                <div className="py-16 text-center text-brand-muted text-xs glass rounded-3xl">
                  No hay transacciones registradas.
                </div>
              ) : (
                movements.map(m => {
                  const date = new Date(m.creado_en)
                  const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  const isSalida = m.tipo === 'Salida'
                  const prodName = m.producto_nombre || (products.find(p => p.id === m.producto_id)?.nombre) || 'Insumo'
                  const unit = m.unidad_medida || (products.find(p => p.id === m.producto_id)?.unidad_medida) || ''
                  
                  return (
                    <div
                      key={m.id}
                      className="glass rounded-2.5xl p-4 border border-brand-border flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9px] text-brand-muted font-bold block">{formattedDate}</span>
                          <h4 className="text-sm font-extrabold text-brand-text mt-0.5">{prodName}</h4>
                        </div>
                        
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          isSalida 
                            ? 'bg-red-500/10 text-red-500 border border-red-500/10' 
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10'
                        }`}>
                          {isSalida ? 'Salida' : 'Entrada'}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-brand-border/40 pt-2 text-xs">
                        <div>
                          <span className="text-[9px] text-brand-muted block">Responsable</span>
                          <span className="font-semibold text-brand-text">{m.usuario_email || 'chef.demo@nexus.com'}</span>
                        </div>
                        
                        <div className="text-right">
                          <span className="text-[9px] text-brand-muted block">Cantidad</span>
                          <span className={`font-black text-sm ${isSalida ? 'text-red-500' : 'text-emerald-500'}`}>
                            {isSalida ? '-' : '+'}{m.cantidad} <span className="text-xs font-normal text-brand-muted">{unit}</span>
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 text-xs bg-slate-500/5 p-2 rounded-xl border border-brand-border/30">
                        <span className="text-[9px] text-brand-muted block font-bold uppercase tracking-wider">Motivo</span>
                        <p className="text-brand-muted italic mt-0.5">{m.motivo}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* --- BOTÓN DE ACCIÓN FLOTANTE (FAB) --- */}
      {activeTab === 'dashboard' && !showProductModal && !showMovementModal && (
        <button
          onClick={() => setShowProductModal(true)}
          className="fixed bottom-20 md:bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20 active:scale-95 transition-all z-40 border border-blue-400/20 cursor-pointer"
          title="Agregar Insumo"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* --- NAVEGACIÓN MÓVIL INFERIOR (Bottom Bar - Solo Móviles) --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 glass border-t border-brand-border flex items-center justify-around z-40 px-2 shadow-2xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center w-16 h-full transition-all cursor-pointer ${
            activeTab === 'dashboard' ? 'text-blue-500 scale-105' : 'text-brand-muted'
          }`}
        >
          <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
          </svg>
          <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">Almacén</span>
        </button>

        <button
          onClick={() => setActiveTab('alertas')}
          className={`flex flex-col items-center justify-center w-16 h-full transition-all relative cursor-pointer ${
            activeTab === 'alertas' ? 'text-amber-500 scale-105' : 'text-brand-muted'
          }`}
        >
          {metrics.alerts > 0 && (
            <span className="absolute top-2 right-4 w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          )}
          <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === 'alertas' ? 2.5 : 2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">Alertas</span>
        </button>

        <button
          onClick={() => setActiveTab('historial')}
          className={`flex flex-col items-center justify-center w-16 h-full transition-all cursor-pointer ${
            activeTab === 'historial' ? 'text-purple-500 scale-105' : 'text-brand-muted'
          }`}
        >
          <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === 'historial' ? 2.5 : 2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">Auditoría</span>
        </button>
      </nav>

      {/* --- BOTTOM SHEET / MODAL: REGISTRAR MOVIMIENTO (Ergonómico Móvil) --- */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          {/* Backdrop click close */}
          <div className="absolute inset-0 cursor-default" onClick={() => { setShowMovementModal(false); resetMovementForm(); }}></div>
          
          <div className="w-full md:max-w-md bg-brand-bg md:rounded-3xl rounded-t-[2.5rem] p-6 border-t md:border border-brand-border shadow-2xl relative z-10 animate-bottom-sheet md:animate-slide-up pb-10 md:pb-6">
            
            {/* Mobile Drag Handle */}
            <div className="md:hidden w-12 h-1.5 bg-brand-border rounded-full mx-auto mb-5"></div>
            
            <h3 className="text-lg font-extrabold text-brand-text mb-4">
              Registrar {movementType === 'Entrada' ? 'Entrada (+)' : 'Salida (-)'}
            </h3>

            {selectedProductForMov && (
              <div className="mb-4.5 p-3.5 bg-brand-card rounded-2xl border border-brand-border flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-brand-muted font-bold block">Insumo</span>
                  <span className="text-sm font-extrabold text-brand-text">
                    {products.find(p => p.id === selectedProductForMov)?.nombre}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-brand-muted font-bold block">Stock Disponible</span>
                  <span className="text-sm font-extrabold text-blue-500">
                    {products.find(p => p.id === selectedProductForMov)?.stock_actual} {products.find(p => p.id === selectedProductForMov)?.unidad_medida}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleRegisterMovement} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Cantidad a registrar</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={movementQty}
                    onChange={(e) => setMovementQty(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-2xl bg-brand-card border border-brand-border text-brand-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm h-12"
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-bold text-brand-muted">
                    {products.find(p => p.id === selectedProductForMov)?.unidad_medida}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Detalle / Motivo</label>
                <textarea
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder={movementType === 'Entrada' ? 'Ej: Recepción proveedor, Factura #90' : 'Ej: Almuerzo diario, merma'}
                  rows="3"
                  className="w-full px-4 py-3 rounded-2xl bg-brand-card border border-brand-border text-brand-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm"
                />
              </div>

              {movementError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
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
                  className="px-4 h-11 rounded-xl btn-secondary font-bold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 h-11 rounded-xl text-white font-bold text-xs transition-all shadow-md flex items-center justify-center space-x-1 cursor-pointer ${
                    movementType === 'Entrada' 
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/10' 
                      : 'bg-red-600 hover:bg-red-500 shadow-red-500/10'
                  }`}
                >
                  <span>Procesar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- BOTTOM SHEET / MODAL: NUEVO INSUMO --- */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0 cursor-default" onClick={() => { setShowProductModal(false); resetProductForm(); }}></div>
          
          <div className="w-full md:max-w-md bg-brand-bg md:rounded-3xl rounded-t-[2.5rem] p-6 border-t md:border border-brand-border shadow-2xl relative z-10 animate-bottom-sheet md:animate-slide-up pb-10 md:pb-6">
            
            <div className="md:hidden w-12 h-1.5 bg-brand-border rounded-full mx-auto mb-5"></div>
            
            <h3 className="text-lg font-extrabold text-brand-text mb-4">
              Registrar Nuevo Insumo
            </h3>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Nombre del Insumo</label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Ej: Harina de Trigo, Cilantro"
                  className="w-full px-4 py-3 rounded-2xl bg-brand-card border border-brand-border text-brand-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm h-12"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Categoría</label>
                  <select
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-brand-card border border-brand-border text-brand-text focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-xs h-12 cursor-pointer"
                  >
                    <option value="">Seleccionar...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Métrica (Unidad)</label>
                  <select
                    value={newProductUnit}
                    onChange={(e) => setNewProductUnit(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-brand-card border border-brand-border text-brand-text focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-xs h-12 cursor-pointer"
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
                <label className="block text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Límite de Alerta (Stock Mínimo)</label>
                <input
                  type="number"
                  step="any"
                  value={newProductMinStock}
                  onChange={(e) => setNewProductMinStock(e.target.value)}
                  placeholder="Ej: 10.00"
                  className="w-full px-4 py-3 rounded-2xl bg-brand-card border border-brand-border text-brand-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm h-12"
                />
              </div>

              <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl text-[10px] text-blue-500 font-semibold flex items-start space-x-2 leading-snug">
                <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Por integridad, el stock inicia en 0. Para dotar de insumos al nuevo registro, efectúa una Entrada (+).</span>
              </div>

              {newProductError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
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
                  className="px-4 h-11 rounded-xl btn-secondary font-bold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                >
                  Crear Insumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
