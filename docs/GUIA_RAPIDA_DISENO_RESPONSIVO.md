# 🎨 Guía Rápida - Diseño Responsivo del Portal

## 📱 Vista Rápida de Dispositivos

### 📱 Mobile (390px - iPhone 12)
```
┌──────────────────────┐
│  ╳        BIOSANARCALL   │
├──────────────────────┤
│ Mis Citas           │
│                      │
│ ┌────────────────┐  │
│ │ 15             │  │
│ │ OCT            │  │
│ │ 2025           │  │
│ ├────────────────┤  │
│ │ 10:30 AM      │  │
│ │ 🟢 Confirmada  │  │
│ │ Dr. García     │  │
│ │ Cardiología    │  │
│ └────────────────┘  │
│                      │
│ ┌────────────────┐  │
│ │ [QR BUTTON]    │  │
│ └────────────────┘  │
│                      │
│ Lista de Espera    │
│ 🟡 Pos. #2        │  │
│ Prioridad: Alta    │  │
│                      │
└──────────────────────┘
```

**Características:**
- Padding: `p-3` (12px)
- Font: Base
- Grid: 1 columna
- Buttons: Full-width

---

### 💻 Tablet (768px - iPad)
```
┌────────────────────────────────┐
│     ╳    BIOSANARCALL     👤    │
├────────────────────────────────┤
│ Mis Citas                       │
│                                  │
│ ┌──────────────┐  ┌──────────┐ │
│ │ 15  10:30 AM │  │ 16 2:00P │ │
│ │ OCT Confirm  │  │ OCT Pend │ │
│ │ 2025         │  │ 2025     │ │
│ │              │  │          │ │
│ │ Dr. García   │  │ Dr. López│ │
│ │ Cardiología  │  │ Neurology│ │
│ └──────────────┘  └──────────┘ │
│                                  │
└────────────────────────────────┘
```

**Características:**
- Padding: `sm:p-4` (16px)
- Font: Small
- Grid: 2 columnas
- Buttons: Inline

---

### 🖥️ Desktop (1920px)
```
┌────────────────────────────────────────────────────────────┐
│   ╳  BIOSANARCALL  (Documento: 1234567890)      [LOGOUT]   │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  📅 Mis Citas                                              │
│  Consulta y gestiona tus citas médicas                     │
│                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ 15               #1 │  │ 16               #2 │          │
│  │ OCT  10:30 AM     │  │ OCT  02:00 PM     │          │
│  │ 2025 🟢 Confirmada│  │ 2025 🟡 Pendiente │          │
│  │                     │  │                     │          │
│  │ 👤 Dr. García      │  │ 👤 Dr. López       │          │
│  │ 📋 Cardiología     │  │ 📋 Neurología      │          │
│  │ 📍 Sede Centro     │  │ 📍 Sede Norte      │          │
│  │                     │  │                     │          │
│  │ [QR Download]      │  │ [QR Download]      │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                              │
│  ┌─────────────────────┐                                  │
│  │ 20                                                      │
│  │ OCT  04:30 PM                                           │
│  │ 2025 🔵 Completada                                      │
│  │ Dr. Martínez - Traumatología                            │
│  └─────────────────────┘                                  │
│                                                              │
│  🟡 Lista de Espera (1 solicitud)                          │
│                                                              │
│  ┌──────────────────────────────────────────────┐          │
│  │ #1 Próximo para asignar    🔴 URGENTE       │          │
│  │ 📋 Oftalmología                              │          │
│  │ ⏱️  En espera 2 horas                        │          │
│  │ 👤 Dr. Rodríguez                            │          │
│  │ 📍 Sede Sur                                  │          │
│  └──────────────────────────────────────────────┘          │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

**Características:**
- Padding: `lg:px-8` (32px)
- Font: Large
- Grid: 2 columnas
- Buttons: Optimizados

---

## 🎨 Sistema de Colores

### Prioridades
```
🔴 URGENTE   → bg-red-100,    text-red-800,    border-red-200
🟠 ALTA      → bg-orange-100, text-orange-800, border-orange-200
🔵 NORMAL    → bg-blue-100,   text-blue-800,   border-blue-200
⚪ BAJA      → bg-gray-100,   text-gray-800,   border-gray-200
```

### Estados de Citas
```
🟢 CONFIRMADA  → bg-green-100,  text-green-800,  border-green-200
🟡 PENDIENTE   → bg-yellow-100, text-yellow-800, border-yellow-200
🔴 CANCELADA   → bg-red-100,    text-red-800,    border-red-200
🔵 COMPLETADA  → bg-blue-100,   text-blue-800,   border-blue-200
```

### Componentes
```
PRIMARY      → Blue-600   (#2563EB)
SECONDARY    → Blue-700   (#1D4ED8)
ACCENT       → Yellow-500 (#EAB308)
SUCCESS      → Green-600  (#16A34A)
WARNING      → Orange-500 (#F97316)
ERROR        → Red-600    (#DC2626)
BACKGROUND   → White      (#FFFFFF)
SURFACE      → Gray-50    (#F9FAFB)
```

---

## 📐 Espaciado

### Horizontal Padding
```
Mobile:   p-3 sm:p-4   → 12px → 16px
Tablet:   sm:px-6      → 24px
Desktop:  lg:px-8      → 32px
```

### Gap entre elementos
```
Pequeño:  gap-2 sm:gap-3   → 8px → 12px
Mediano:  gap-3 sm:gap-4   → 12px → 16px
Grande:   gap-4 sm:gap-6   → 16px → 24px
```

### Vertical Spacing
```
Secciones:  mt-6 sm:mt-8    → 24px → 32px
Entre items: py-4 sm:py-5   → 16px → 20px
Dentro card: p-4 sm:p-6     → 16px → 24px
```

---

## 🔤 Tipografía

### Tamaños
```
Label:   text-xs sm:text-sm     → 12px → 14px
Body:    text-sm sm:text-base   → 14px → 16px
Title:   text-lg sm:text-xl     → 18px → 20px
Heading: text-2xl sm:text-3xl   → 24px → 30px
```

### Pesos
```
Regular:   font-normal    → 400
Medium:    font-semibold  → 600
Bold:      font-bold      → 700
Mono:      font-mono      → Código/IDs
```

---

## 🎬 Animaciones

### Transiciones
```
Rápida:     transition-all duration-200
Suave:      transition-all duration-300
Lenta:      transition-all duration-500

Easing:     ease-in-out (default)
```

### Efectos Hover
```
Shadow:     hover:shadow-xl
Scale:      group-hover:scale-110
Color:      hover:from-blue-700 hover:to-blue-800
```

### Estados
```
Active:     active:scale-95         → Al hacer click
Disabled:   opacity-50 cursor-not-allowed
Focus:      focus:ring-2 focus:ring-blue-500
```

---

## ✅ Componentes Key

### Cards
```tsx
<div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl transition-all">
  {/* Content */}
</div>
```

### Badge
```tsx
<span className="px-3 py-1.5 rounded-full text-sm font-bold border-2 bg-blue-100 text-blue-800 border-blue-200">
  Estado
</span>
```

### Icon Badge
```tsx
<div className="bg-blue-100 rounded-lg p-2.5">
  <IconComponent className="w-5 h-5 text-blue-600" />
</div>
```

### Button
```tsx
<button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all active:scale-95">
  Action
</button>
```

### Sticky Header
```tsx
<div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
  {/* Header content */}
</div>
```

---

## 🧪 Testing Checklist

### Responsive
- ✅ Mobile (320px - 480px)
- ✅ Tablet (480px - 768px)
- ✅ Desktop (768px+)

### Performance
- ✅ Build time < 30s
- ✅ CSS size < 150KB
- ✅ LCP < 2.5s
- ✅ FID < 100ms

### Accessibility
- ✅ WCAG AA contrast
- ✅ Touch targets 44px+
- ✅ Keyboard navigation
- ✅ Screen reader support

### Cross-browser
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

---

## 🚀 Quick Commands

```bash
# Desarrollo
npm run dev          # Start dev server

# Producción
npm run build        # Build para production
npm run preview      # Preview build

# Linting
npm run lint         # Check code quality
npm run type-check   # TypeScript check
```

---

## 📦 Dependencias Clave

- **React 18** - Framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Components
- **Lucide React** - Icons
- **Vite** - Build tool

---

**Última actualización:** 2025  
**Versión:** 2.0  
**Status:** ✅ Producción
