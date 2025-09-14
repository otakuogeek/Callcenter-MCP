#!/bin/bash

# Colores para la interfaz
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

clear

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    ${WHITE}BIOSANARCALL - LISTADO DE MÉDICOS${CYAN}                    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"

# Función para mostrar el menú principal
show_main_menu() {
    echo ""
    echo -e "${YELLOW}¿Cómo te gustaría ver el listado de médicos?${NC}"
    echo ""
    echo -e "${GREEN}1.${NC} Ver todos los médicos (resumen)"
    echo -e "${GREEN}2.${NC} Filtrar por especialidad"
    echo -e "${GREEN}3.${NC} Filtrar por sede"
    echo -e "${GREEN}4.${NC} Ver médicos con detalles completos"
    echo -e "${GREEN}5.${NC} Buscar médico específico"
    echo -e "${GREEN}6.${NC} Estadísticas del equipo médico"
    echo -e "${RED}0.${NC} Salir"
    echo ""
    echo -e "${BLUE}Selecciona una opción [0-6]:${NC} "
}

# Función para obtener datos del MCP
get_doctors_data() {
    curl -s -X POST http://localhost:8977/mcp-unified \
      -H "Content-Type: application/json" \
      -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
          "name": "getDoctors",
          "arguments": {}
        }
      }' | jq -r '.result.content[0].text' | jq '.'
}

# Función para mostrar resumen de médicos
show_doctors_summary() {
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}                     RESUMEN DE MÉDICOS DISPONIBLES${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    
    local data=$(get_doctors_data)
    local total=$(echo "$data" | jq -r '.total')
    
    echo -e "${CYAN}Total de médicos activos: ${WHITE}$total${NC}"
    echo ""
    
    echo "$data" | jq -r '.doctors[] | "\(.name) - \(.specialties[0].name) - \(.locations | map(.name) | join(", "))"' | \
    while IFS= read -r line; do
        local name=$(echo "$line" | cut -d' -' -f1)
        local specialty=$(echo "$line" | cut -d' -' -f2)
        local locations=$(echo "$line" | cut -d' -' -f3-)
        
        echo -e "${GREEN}👨‍⚕️  ${WHITE}$name${NC}"
        echo -e "    ${YELLOW}📋 Especialidad:${NC} $specialty"
        echo -e "    ${BLUE}🏥 Sedes:${NC} $locations"
        echo ""
    done
}

# Función para filtrar por especialidad
filter_by_specialty() {
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}                    MÉDICOS POR ESPECIALIDAD${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    
    local data=$(get_doctors_data)
    
    # Obtener especialidades únicas
    local specialties=$(echo "$data" | jq -r '.doctors[].specialties[].name' | sort | uniq)
    
    echo -e "${YELLOW}Especialidades disponibles:${NC}"
    echo ""
    
    local counter=1
    while IFS= read -r specialty; do
        echo -e "${GREEN}$counter.${NC} $specialty"
        ((counter++))
    done <<< "$specialties"
    
    echo ""
    echo -e "${BLUE}Selecciona el número de la especialidad (0 para volver):${NC} "
    read -r choice
    
    if [[ "$choice" == "0" ]]; then
        return
    fi
    
    local selected_specialty=$(echo "$specialties" | sed -n "${choice}p")
    
    if [[ -n "$selected_specialty" ]]; then
        echo ""
        echo -e "${CYAN}Médicos especializados en: ${WHITE}$selected_specialty${NC}"
        echo ""
        
        echo "$data" | jq -r --arg spec "$selected_specialty" '.doctors[] | select(.specialties[].name == $spec) | "\(.name)|\(.phone)|\(.locations | map(.name) | join(", "))"' | \
        while IFS='|' read -r name phone locations; do
            echo -e "${GREEN}👨‍⚕️  ${WHITE}$name${NC}"
            echo -e "    ${YELLOW}📞 Teléfono:${NC} $phone"
            echo -e "    ${BLUE}🏥 Sedes:${NC} $locations"
            echo ""
        done
    else
        echo -e "${RED}Opción inválida${NC}"
    fi
    
    echo -e "${BLUE}Presiona Enter para continuar...${NC}"
    read
}

# Función para filtrar por sede
filter_by_location() {
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}                       MÉDICOS POR SEDE${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    
    local data=$(get_doctors_data)
    
    # Obtener sedes únicas
    local locations=$(echo "$data" | jq -r '.doctors[].locations[].name' | sort | uniq)
    
    echo -e "${YELLOW}Sedes disponibles:${NC}"
    echo ""
    
    local counter=1
    while IFS= read -r location; do
        echo -e "${GREEN}$counter.${NC} $location"
        ((counter++))
    done <<< "$locations"
    
    echo ""
    echo -e "${BLUE}Selecciona el número de la sede (0 para volver):${NC} "
    read -r choice
    
    if [[ "$choice" == "0" ]]; then
        return
    fi
    
    local selected_location=$(echo "$locations" | sed -n "${choice}p")
    
    if [[ -n "$selected_location" ]]; then
        echo ""
        echo -e "${CYAN}Médicos disponibles en: ${WHITE}$selected_location${NC}"
        echo ""
        
        echo "$data" | jq -r --arg loc "$selected_location" '.doctors[] | select(.locations[].name == $loc) | "\(.name)|\(.specialties[0].name)|\(.phone)"' | \
        while IFS='|' read -r name specialty phone; do
            echo -e "${GREEN}👨‍⚕️  ${WHITE}$name${NC}"
            echo -e "    ${YELLOW}📋 Especialidad:${NC} $specialty"
            echo -e "    ${YELLOW}📞 Teléfono:${NC} $phone"
            echo ""
        done
    else
        echo -e "${RED}Opción inválida${NC}"
    fi
    
    echo -e "${BLUE}Presiona Enter para continuar...${NC}"
    read
}

# Función para mostrar detalles completos
show_detailed_doctors() {
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}                   MÉDICOS - INFORMACIÓN DETALLADA${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    
    local data=$(get_doctors_data)
    
    echo "$data" | jq -r '.doctors[] | "\(.name)|\(.email)|\(.phone)|\(.license_number)|\(.specialties[0].name)|\(.locations | map(.name) | join(", "))"' | \
    while IFS='|' read -r name email phone license specialty locations; do
        echo -e "${GREEN}👨‍⚕️  ${WHITE}$name${NC}"
        echo -e "    ${YELLOW}📧 Email:${NC} $email"
        echo -e "    ${YELLOW}📞 Teléfono:${NC} $phone"
        echo -e "    ${YELLOW}📄 Licencia:${NC} $license"
        echo -e "    ${YELLOW}📋 Especialidad:${NC} $specialty"
        echo -e "    ${BLUE}🏥 Sedes:${NC} $locations"
        echo -e "${PURPLE}─────────────────────────────────────────────────────────────────${NC}"
    done
    
    echo -e "${BLUE}Presiona Enter para continuar...${NC}"
    read
}

# Función para buscar médico específico
search_doctor() {
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}                      BUSCAR MÉDICO ESPECÍFICO${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    
    echo -e "${BLUE}Ingresa el nombre del médico a buscar:${NC} "
    read -r search_term
    
    if [[ -z "$search_term" ]]; then
        echo -e "${RED}Por favor ingresa un nombre válido${NC}"
        echo -e "${BLUE}Presiona Enter para continuar...${NC}"
        read
        return
    fi
    
    local data=$(get_doctors_data)
    local found=false
    
    echo ""
    echo -e "${CYAN}Resultados de búsqueda para: ${WHITE}$search_term${NC}"
    echo ""
    
    echo "$data" | jq -r --arg term "$search_term" '.doctors[] | select(.name | test($term; "i")) | "\(.name)|\(.email)|\(.phone)|\(.license_number)|\(.specialties[0].name)|\(.locations | map(.name) | join(", "))"' | \
    while IFS='|' read -r name email phone license specialty locations; do
        found=true
        echo -e "${GREEN}👨‍⚕️  ${WHITE}$name${NC}"
        echo -e "    ${YELLOW}📧 Email:${NC} $email"
        echo -e "    ${YELLOW}📞 Teléfono:${NC} $phone"
        echo -e "    ${YELLOW}📄 Licencia:${NC} $license"
        echo -e "    ${YELLOW}📋 Especialidad:${NC} $specialty"
        echo -e "    ${BLUE}🏥 Sedes:${NC} $locations"
        echo ""
    done
    
    if [[ "$found" == false ]]; then
        echo -e "${RED}No se encontraron médicos que coincidan con: $search_term${NC}"
    fi
    
    echo -e "${BLUE}Presiona Enter para continuar...${NC}"
    read
}

# Función para mostrar estadísticas
show_statistics() {
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}                   ESTADÍSTICAS DEL EQUIPO MÉDICO${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    
    local data=$(get_doctors_data)
    local total=$(echo "$data" | jq -r '.total')
    
    echo -e "${CYAN}📊 RESUMEN GENERAL:${NC}"
    echo -e "   ${GREEN}Total de médicos activos:${NC} $total"
    echo ""
    
    echo -e "${CYAN}📋 POR ESPECIALIDAD:${NC}"
    echo "$data" | jq -r '.doctors[].specialties[].name' | sort | uniq -c | \
    while read -r count specialty; do
        echo -e "   ${GREEN}$specialty:${NC} $count médico(s)"
    done
    
    echo ""
    echo -e "${CYAN}🏥 POR SEDE:${NC}"
    echo "$data" | jq -r '.doctors[].locations[].name' | sort | uniq -c | \
    while read -r count location; do
        echo -e "   ${GREEN}$location:${NC} $count médico(s)"
    done
    
    echo ""
    echo -e "${BLUE}Presiona Enter para continuar...${NC}"
    read
}

# Menú principal
while true; do
    show_main_menu
    read -r option
    
    case $option in
        1)
            clear
            show_doctors_summary
            ;;
        2)
            clear
            filter_by_specialty
            ;;
        3)
            clear
            filter_by_location
            ;;
        4)
            clear
            show_detailed_doctors
            ;;
        5)
            clear
            search_doctor
            ;;
        6)
            clear
            show_statistics
            ;;
        0)
            echo -e "${GREEN}¡Gracias por usar el sistema de consulta de médicos!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Opción inválida. Por favor selecciona una opción del 0 al 6.${NC}"
            sleep 2
            ;;
    esac
    
    clear
done