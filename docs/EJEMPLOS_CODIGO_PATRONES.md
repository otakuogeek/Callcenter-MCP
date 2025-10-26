# 💻 EJEMPLOS DE CÓDIGO - Patrones Implementados

## 🎨 Layout Responsivo Principal

### Container Base
```tsx
<div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-gray-100">
  {/* Sticky Header */}
  <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Header content */}
    </div>
  </div>

  {/* Main Content */}
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
    {/* Content */}
  </div>
</div>
```

### Breakpoint Reference
```tsx
// Mobile (default)
p-3 text-base

// Tablet
sm:p-4 sm:text-sm

// Medium
md:text-lg md:grid-cols-2

// Large
lg:px-8 lg:text-xl
```

---

## 🎫 Tarjeta de Cita (Card Pattern)

### Estructura Completa
```tsx
<div className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
  {/* Header con gradiente */}
  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-4 sm:py-5">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      {/* Fecha con backdrop */}
      <div className="flex items-center gap-4">
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center min-w-fit">
          <div className="text-2xl sm:text-3xl font-bold">{day}</div>
          <div className="text-xs sm:text-sm uppercase tracking-widest opacity-90">{month}</div>
          <div className="text-xs opacity-75">{year}</div>
        </div>
        <div>
          <div className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <TimeIcon className="w-5 h-5" />
            {time}
          </div>
          <p className="text-xs sm:text-sm opacity-90 mt-1">Hora de consulta</p>
        </div>
      </div>

      {/* Estado y ID */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs opacity-75">Cita N°</p>
          <p className="text-sm sm:text-base font-mono font-bold">#{id}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 whitespace-nowrap ${statusColor}`}>
          {status}
        </span>
      </div>
    </div>
  </div>

  {/* Contenido Principal */}
  <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-4">
    {/* Grid de información */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Doctor */}
      <InfoBadge
        icon={DoctorIcon}
        label="Doctor(a)"
        value={doctorName}
        bgColor="bg-blue-100"
        iconColor="text-blue-600"
      />

      {/* Especialidad */}
      <InfoBadge
        icon={SpecialityIcon}
        label="Especialidad"
        value={specialty}
        bgColor="bg-purple-100"
        iconColor="text-purple-600"
      />

      {/* Sede */}
      <InfoBadge
        icon={LocationIcon}
        label="Sede"
        value={location}
        bgColor="bg-green-100"
        iconColor="text-green-600"
      />
    </div>

    {/* Motivo */}
    {reason && (
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <p className="text-xs sm:text-sm font-bold text-gray-700 mb-2">Motivo de consulta:</p>
        <p className="text-sm text-gray-600 leading-relaxed">{reason}</p>
      </div>
    )}

    {/* Botón QR */}
    <button
      onClick={handleQR}
      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 group/btn"
    >
      <QrCode className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
      <Download className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
      <span>Descargar QR de Cita</span>
    </button>
  </div>
</div>
```

---

## 🏷️ Info Badge Component (Reutilizable)

### Pattern
```tsx
function InfoBadge({ icon: Icon, label, value, bgColor, iconColor }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`${bgColor} rounded-lg p-2.5 mt-0.5`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}
```

---

## 🟡 Tarjeta de Lista de Espera

### Estructura
```tsx
<div className="group bg-white rounded-2xl border-2 border-yellow-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
  {/* Header Amarillo */}
  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-200 px-4 sm:px-6 py-4 sm:py-5">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      {/* Badge de Posición Circular */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-yellow-500 text-white rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center font-bold text-sm sm:text-base">
          #{position}
        </div>
        <div>
          <p className="text-xs sm:text-sm text-gray-600 font-medium">Posición en lista</p>
          <p className="font-semibold text-gray-900">
            {position === 1 ? 'Próximo para asignar' : `${position - 1} antes que tú`}
          </p>
        </div>
      </div>

      {/* Badges de Prioridad */}
      <div className="flex items-center gap-2 flex-wrap">
        <PriorityBadge priority={priority} />
        {isUrgent && <UrgentBadge />}
      </div>
    </div>
  </div>

  {/* Contenido */}
  <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-4">
    {/* Grid de información */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <InfoBadge {...specialtyProps} />
      <InfoBadge {...waitTimeProps} />
      {doctor && <InfoBadge {...doctorProps} />}
      {location && <InfoBadge {...locationProps} />}
    </div>

    {/* Información adicional */}
    {reason && <ReasonBox reason={reason} />}
    {cupsCode && <CupsBox code={cupsCode} name={cupsName} />}

    {/* Mensaje informativo */}
    <InfoMessage text="Te notificaremos automáticamente cuando se libere un cupo..." />
  </div>

  {/* Footer con ID */}
  <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-3 text-right">
    <p className="text-xs sm:text-sm text-gray-600">
      Solicitud N° <span className="font-mono font-bold text-gray-900">#{itemId}</span>
    </p>
  </div>
</div>
```

---

## 🎨 Badge Components

### Priority Badge
```tsx
const priorityColors = {
  'Urgente': 'bg-red-100 text-red-800 border-red-200',
  'Alta': 'bg-orange-100 text-orange-800 border-orange-200',
  'Normal': 'bg-blue-100 text-blue-800 border-blue-200',
  'Baja': 'bg-gray-100 text-gray-800 border-gray-200'
};

<span className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold border-2 ${priorityColors[priority]}`}>
  {priority}
</span>
```

### Status Badge
```tsx
const statusColors = {
  'Confirmada': 'bg-green-100 text-green-800 border-green-200',
  'Pendiente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Cancelada': 'bg-red-100 text-red-800 border-red-200',
  'Completada': 'bg-blue-100 text-blue-800 border-blue-200'
};

<span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${statusColors[status]}`}>
  {status}
</span>
```

---

## 📱 Grid Responsivo

### Container Grid
```tsx
{/* Grid que se adapta */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
  {appointments.map((apt) => (
    <div key={apt.id} className="...">
      {/* Card */}
    </div>
  ))}
</div>
```

### Responsive Breakpoints
```
- grid-cols-1      → 1 columna (mobile default)
- lg:grid-cols-2   → 2 columnas (desktop 1024px+)
- gap-4            → 16px (mobile)
- sm:gap-6         → 24px (tablet+)
```

---

## 🎬 Animaciones

### Smooth Transitions
```tsx
{/* Transición suave en hover */}
<div className="transition-all duration-300 hover:shadow-xl">
  {/* Content */}
</div>
```

### Active State
```tsx
{/* Efecto al hacer click */}
<button className="active:scale-95 transition-transform">
  Click me
</button>
```

### Group Hover
```tsx
<div className="group">
  {/* Parent */}
  <div className="group-hover:scale-110 transition-transform">
    {/* Child que escala al hover del parent */}
  </div>
</div>
```

---

## 📝 Input Component Pattern

### Con Icon Prefix
```tsx
<div className="relative">
  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
    <EnvelopeIcon className="w-5 h-5" />
  </span>
  <input
    type="email"
    placeholder="tu@email.com"
    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  />
</div>
```

---

## 🔘 Button Patterns

### Primary Button
```tsx
<button className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-6 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 active:scale-95">
  Primary Action
</button>
```

### Secondary Button
```tsx
<button className="border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200">
  Secondary Action
</button>
```

### Icon Button
```tsx
<button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
  <IconComponent className="w-5 h-5 text-gray-600" />
</button>
```

---

## 🎯 Utilidades Tailwind Comunes

### Spacing
```tsx
p-3 sm:p-4 md:p-5 lg:p-6      // Padding responsivo
m-2 sm:m-3 md:m-4              // Margin responsivo
gap-3 sm:gap-4 md:gap-6        // Gap responsivo
space-y-4 sm:space-y-6         // Espaciado vertical
```

### Typography
```tsx
text-xs sm:text-sm md:text-base lg:text-lg
font-normal font-semibold font-bold
tracking-wide tracking-widest
leading-relaxed
```

### Colors
```tsx
bg-blue-600 hover:bg-blue-700
text-gray-900 text-gray-600 text-gray-500
border-gray-200 hover:border-gray-400
```

### Responsive Display
```tsx
hidden sm:block                // Visible solo en tablet+
block sm:hidden               // Visible solo en mobile
flex flex-col sm:flex-row     // Stack en mobile, row en tablet+
```

---

## 🧪 Testing Snippets

### Mobile Viewport
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### Accessibility Checks
```tsx
// Ensure colors have proper contrast
// Test keyboard navigation
// Verify touch targets are 44px+
// Check for proper heading hierarchy
```

---

**Última actualización:** 2025  
**Versión:** 2.0  
**Ejemplos:** 15+ patrones
