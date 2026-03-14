---
applyTo: "frontend/**"
description: "Frontend React+Vite conventions: shadcn/ui components, TanStack Query, React Hook Form+Zod, lazy loading, sidebar layout pattern, API client usage."
---

# Frontend Conventions

## Component Library
- **shadcn/ui + Radix** exclusively — never build custom UI primitives
- Import from `@/components/ui/` (button, dialog, form, table, etc.)
- Styling: Tailwind CSS utility classes only

## Forms
```tsx
const form = useForm<FormData>({ resolver: zodResolver(schema) });
// Always use React Hook Form + Zod — no uncontrolled forms
```

## Data Fetching
```tsx
const { data, isLoading } = useQuery({
  queryKey: ['patients', filters],
  queryFn: () => api.getPatients(filters),
  refetchOnWindowFocus: false,  // Always disable window refocus
});
```

## Page Layout (required for every page)
```tsx
<SidebarProvider>
  <AppSidebar />
  <main className="w-full">
    <SidebarTrigger />
    {/* Page content */}
  </main>
</SidebarProvider>
```

## Route Registration (`App.tsx`)
All pages must be lazy-loaded:
```tsx
const NewPage = lazy(() => import("./pages/NewPage"));
// In router:
<Route path="/new-page" element={<ProtectedRoute><Suspense fallback={<LoadingScreen />}><NewPage /></Suspense></ProtectedRoute>} />
```

## API Client
- Always use `frontend/src/lib/api.ts` — never raw `fetch()`
- 401 responses auto-redirect to login
- Path alias: `@/` → `frontend/src/`

## Port
Dev and preview: **8080** (not 5173)
