#!/bin/bash

# Backend routes
find ./backend/src/routes -type f -name "*.ts" -exec sed -i 's/status = '\''Activa'\''/status = '\''active'\''/g' {} +
find ./backend/src/routes -type f -name "*.ts" -exec sed -i 's/status = "Activa"/status = "active"/g' {} +
find ./backend/src/routes -type f -name "*.ts" -exec sed -i 's/status = '\''Cancelada'\''/status = '\''cancelled'\''/g' {} +
find ./backend/src/routes -type f -name "*.ts" -exec sed -i 's/status = "Cancelada"/status = "cancelled"/g' {} +
find ./backend/src/routes -type f -name "*.ts" -exec sed -i 's/status = '\''Completa'\''/status = '\''completed'\''/g' {} +
find ./backend/src/routes -type f -name "*.ts" -exec sed -i 's/status = "Completa"/status = "completed"/g' {} +

# Frontend components
find ./frontend/src/components -type f -name "*.tsx" -exec sed -i 's/status === '\''Activa'\''/status === '\''active'\''/g' {} +
find ./frontend/src/components -type f -name "*.tsx" -exec sed -i 's/status === "Activa"/status === "active"/g' {} +
find ./frontend/src/components -type f -name "*.tsx" -exec sed -i 's/status === '\''Cancelada'\''/status === '\''cancelled'\''/g' {} +
find ./frontend/src/components -type f -name "*.tsx" -exec sed -i 's/status === "Cancelada"/status === "cancelled"/g' {} +
find ./frontend/src/components -type f -name "*.tsx" -exec sed -i 's/status === '\''Completa'\''/status === '\''completed'\''/g' {} +
find ./frontend/src/components -type f -name "*.tsx" -exec sed -i 's/status === "Completa"/status === "completed"/g' {} +

# Location statuses
find . -type f -name "*.ts" -exec sed -i 's/En Mantenimiento/maintenance/g' {} +
find . -type f -name "*.ts" -exec sed -i 's/Inactiva/inactive/g' {} +
find . -type f -name "*.ts" -exec sed -i 's/Liquidación/liquidation/g' {} +

echo "Reemplazo de estados completado"