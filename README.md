
# Proyecto DevOps - Aplicación Web Segura en Kubernetes con Monitoreo Activo
## Valentina Rodriguez y Santiago Santafe

## Descripción del proyecto

Este proyecto corresponde a la entrega final y consolidada del laboratorio técnico de DevOps (Metodología ABP).

El objetivo principal es la implementación de un pipeline CI/CD completamente funcional que integra de extremo a extremo prácticas de seguridad automatizada (**DevSecOps**) y observabilidad en tiempo real (**Monitoreo**), garantizando un ciclo de vida de desarrollo de software eficiente y seguro.

La aplicación está compuesta por:

* **Frontend:** Desarrollado con React y Vite.
* **Backend:** Desarrollado con Node.js y Express.
* **Base de Datos:** MongoDB.
* **Contenedores:** Docker con soporte multi-arquitectura (`linux/amd64`, `linux/arm64`) mediante Docker Buildx.
* **Orquestación:** Manifiestos de Kubernetes ejecutados sobre clúster nativo local (OrbStack).
* **Pipeline CI:** GitHub Actions con escaneos de código, dependencias y build multi-arquitectura.
* **Pipeline CD:** Jenkins con entrega continua y rollback automático ante fallos.
* **Monitoreo:** Prometheus + Grafana desplegados con Helm para recolección y visualización de métricas.

---

## Tecnologías utilizadas y Justificación

| Tecnología | Uso dentro del proyecto | Justificación Técnica |
| --- | --- | --- |
| **GitHub** | Alojamiento del código fuente | Repositorio centralizado para el control de versiones y disparador de eventos CI. |
| **GitHub Actions** | Automatización de CI + Build multi-arch | Ejecuta flujos de trabajo aislados en la nube ante cada push: seguridad, tests y publicación de imágenes multiplataforma. |
| **Jenkins** | Pipeline de Entrega Continua (CD) | Orquesta de forma flexible las etapas de empaquetado, validación, despliegue y rollback automático. |
| **SonarCloud** | Análisis Estático de Código (SAST) | Versión SaaS de SonarQube. Evalúa mantenibilidad, duplicación y detecta fallos de seguridad sin consumir recursos del clúster. |
| **Snyk** | Escaneo de Dependencias (SCA) | Detecta vulnerabilidades y exploits conocidos en librerías de terceros dentro de los `package.json`. |
| **Docker Buildx** | Build multi-arquitectura | Compila imágenes para `linux/amd64` y `linux/arm64` simultáneamente mediante QEMU, garantizando compatibilidad en entornos ARM y x86. |
| **DockerHub** | Registro de imágenes | Almacena imágenes inmutables etiquetadas con el SHA del commit para trazabilidad completa. |
| **Kubernetes (OrbStack)** | Orquestación de Contenedores | Entorno de ejecución que gestiona ciclo de vida, escalado automático (HPA) y red de los Pods. |
| **Helm** | Gestor de Paquetes para K8s | Instala y versiona arquitecturas complejas (como la pila de monitoreo) con un solo comando. |
| **Prometheus** | Recolección de Métricas | Base de datos de series temporales que extrae automáticamente métricas de estado del clúster mediante scraping. |
| **Grafana** | Visualización de Datos | Panel de control interactivo para monitorizar CPU, memoria y rendimiento general en tiempo real. |

---

## Arquitectura del Flujo CI/CD/SecOps

```text
 [ Código Local ] ──> Push a GitHub ──> [ GitHub Actions (CI) ]
                                                │
                                 ┌──────────────┼──────────────┐
                                 ▼              ▼              ▼
                           Backend Job    Frontend Job   docker-build Job
                           Snyk + Test    Snyk + Build   (necesita backend
                           SonarCloud     SonarCloud      y frontend ✔)
                                                │
                                  Docker Buildx (amd64 + arm64)
                                  Push a DockerHub con SHA tag
                                                │
 [ Jenkins (CD en Localhost) ] <── Poll SCM ── Validado ✔️
        │
        ├──> Build Docker Images (Buildx multi-arch)
        ├──> Security Verification (SonarCloud + Snyk)
        ├──> Push to Registry (DockerHub)
        ├──> Deploy to Kubernetes (OrbStack)
        ├──> Verify Prometheus Monitoring
        └── (En caso de fallo) ──> Rollback Automático (kubectl rollout undo)
                                                │
                              [ Prometheus + Grafana Monitoreo Activo ]
```

---

## Estructura Final del Repositorio

```text
proyecto_DevOps/
│
├── .github/
│   └── workflows/
│       └── ci.yml              # Pipeline CI: tests, Snyk, SonarCloud, Docker Buildx
│
├── backend/
│   ├── Dockerfile              # Imagen Node.js 18 con HEALTHCHECK integrado
│   ├── server.js               # API REST Express + MongoDB
│   ├── test.js                 # Tests de integración HTTP (4 casos)
│   ├── package.json
│   ├── api-deployment.yaml     # Deployment K8s (recursos + réplicas)
│   ├── api-service.yaml        # Service LoadBalancer
│   ├── hpa-api.yaml            # HPA: escala 1-5 réplicas al 50% CPU
│   ├── ingress.yaml            # Ingress NGINX para la API
│   ├── mongo-deployment.yaml   # MongoDB con volumen persistente
│   ├── mongo-service.yaml
│   ├── mongo-pv.yaml
│   └── mongo-pvc.yaml
│
├── frontend/
│   ├── Dockerfile              # Multi-stage: Node.js → Nginx con HEALTHCHECK
│   ├── src/                    # App React + Vite
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   └── frontend-ingress.yaml
│
├── monitoring/
│   ├── prometheus.yml          # Configuración de scrape: pods K8s, API, node-exporter
│   └── helm-values.yml         # Values para kube-prometheus-stack (Grafana + Alertmanager)
│
├── docs/
│   ├── github-actions-exitoso.png
│   ├── github-actions-backend.png
│   ├── github-actions-frontend.png
│   ├── jenkins-stage-view.png
│   ├── sonarcloud-dashboard.png
│   ├── snyk-terminal.png
│   └── grafana-dashboard.png
│
├── Jenkinsfile                 # Pipeline CD con rollback automático
└── README.md
```

---

## Pipeline CI - GitHub Actions

El pipeline `ci.yml` ejecuta **tres jobs en paralelo/secuencial** ante cada push a `main`:

### Job 1: Backend CI & Security

| # | Paso | Detalle |
|---|------|---------|
| 1 | Checkout | Historial completo (`fetch-depth: 0`) para SonarCloud |
| 2 | Setup Node.js 20 | Cache de dependencias activado |
| 3 | `npm ci` | Instalación limpia y reproducible |
| 4 | Snyk Scan | Analiza `backend/package.json` — detecta CVEs en dependencias |
| 5 | `npm test` | Ejecuta 4 tests de integración HTTP reales (`test.js`) |
| 6 | SonarCloud | SAST: code smells, security hotspots, duplicación |

### Job 2: Frontend CI & Security

| # | Paso | Detalle |
|---|------|---------|
| 1 | Checkout | Historial completo |
| 2 | Setup Node.js 20 | Cache activado |
| 3 | `npm ci` | Instalación de dependencias |
| 4 | Snyk Scan | Analiza `frontend/package.json` |
| 5 | `npm run build` | Compilación Vite para producción |
| 6 | SonarCloud | Análisis estático del código React |

### Job 3: Docker Build Multi-Architecture *(depende de jobs 1 y 2)*

| # | Paso | Detalle |
|---|------|---------|
| 1 | Setup QEMU | Emulación de arquitecturas ARM |
| 2 | Setup Docker Buildx | Builder multi-plataforma |
| 3 | Login DockerHub | Autenticación con secrets `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` |
| 4 | Build & Push Backend | `linux/amd64,linux/arm64` → `valentinarodro/mi-api:latest` + tag SHA |
| 5 | Build & Push Frontend | `linux/amd64,linux/arm64` → `valentinarodro/frontend:latest` + tag SHA |

> **Secrets requeridos en GitHub → Settings → Secrets → Actions:**
> `SNYK_TOKEN`, `SONAR_TOKEN`, `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`

---

## Pipeline CD - Jenkins

El `Jenkinsfile` define un pipeline declarativo con **6 etapas + rollback automático**:

| Stage | Descripción |
|-------|-------------|
| **Checkout Repository** | Sincroniza el código validado desde GitHub (rama `main`) |
| **Build Docker Images** | Compila imágenes con `docker buildx build --platform linux/amd64,linux/arm64` |
| **Security Verification** | Valida que SonarCloud y Snyk hayan retornado estado PASSED/APPROVED |
| **Push to Registry** | Publica imágenes inmutables etiquetadas `v4` en DockerHub |
| **Deploy to Kubernetes** | Aplica manifiestos YAML del backend (API, MongoDB, HPA, Ingress) y frontend |
| **Verify Prometheus** | Certifica que Prometheus descubra los nuevos targets para iniciar el scraping |

**Rollback automático en caso de fallo:**
```groovy
post {
  failure {
    // Se ejecuta automáticamente si cualquier stage falla
    kubectl rollout undo deployment/api-deployment
    kubectl rollout undo deployment/frontend
    // El cluster queda en el último estado estable conocido
  }
}
```

---

## Health Checks en Contenedores

Ambos Dockerfiles incluyen `HEALTHCHECK` para que Docker (y Kubernetes) detecten automáticamente pods no saludables:

**Backend** — verifica que el endpoint `/` responda HTTP 200:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
```

**Frontend** — verifica que Nginx sirva contenido en el puerto 80:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1
```

Para verificar el estado: `docker inspect <container_id> | grep -A 5 '"Health"'`

---

## Monitoreo con Prometheus y Grafana

### Despliegue del stack (Helm)

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack \
  -f monitoring/helm-values.yml \
  --namespace monitoring --create-namespace
```

El archivo [`monitoring/helm-values.yml`](monitoring/helm-values.yml) configura:
- **Prometheus:** scrape interval 15s, retención 10 días, scrape adicional a `api-service:3000`
- **Grafana:** dashboards precargados (Kubernetes Cluster #6417, Node Exporter #1860), servicio LoadBalancer
- **Alertmanager:** habilitado para alertas configurables
- **Node Exporter:** métricas de nodos del clúster

La configuración de scraping se encuentra en [`monitoring/prometheus.yml`](monitoring/prometheus.yml) e incluye:
- Auto-discovery de pods con anotación `prometheus.io/scrape: "true"`
- Job específico para el backend de la API
- Job para métricas del sistema (node-exporter)

---

## Tests de Integración

El backend cuenta con **4 tests de integración HTTP** en [`backend/test.js`](backend/test.js), ejecutados con `npm test` en el CI:

| # | Test | Validación |
|---|------|-----------|
| 1 | `GET /` | Retorna HTTP 200 con mensaje de salud |
| 2 | `GET /nombres` | Retorna HTTP 200 con un array JSON |
| 3 | `POST /nombres` sin cuerpo | Retorna HTTP 400 con mensaje de error |
| 4 | `POST /nombres` con payload válido | Retorna HTTP 200 con el objeto creado |

Los tests corren en un servidor Express aislado (sin MongoDB) para garantizar ejecución en CI sin dependencias externas.

---

## Evidencias de Ejecución y Resultados

### 1. Integración Continua (CI) — GitHub Actions

**Pipeline completo con jobs concurrentes (Backend + Frontend):**
![GitHub Actions Pipeline Exitoso](docs/github-actions-exitoso.png)

**Job Backend — detalle de pasos:**
![GitHub Actions Backend](docs/github-actions-backend.png)

**Job Frontend — detalle de pasos:**
![GitHub Actions Frontend](docs/github-actions-frontend.png)

### 2. Análisis de Seguridad

**Dashboard SonarCloud — calidad de código y security hotspots:**
![Dashboard de Analisis SonarCloud](docs/sonarcloud-dashboard.png)

**Reporte Snyk — vulnerabilidades en dependencias:**
```text
Tested 89 dependencies for known issues, found 5 issues, 11 vulnerable paths.
- Mongoose v8.10.0 (Alta): Vulnerabilidad de inyección en operaciones MongoDB.
- Express / qs (Alta/Media): DoS y ReDoS por asignación de recursos sin límite.
```
![Consola Escaneo Snyk](docs/snyk-terminal.png)

### 3. Entrega Continua (CD) — Jenkins

**Stage View — ejecución secuencial de todas las etapas:**
![Jenkins Stage View Exitoso](docs/jenkins-stage-view.png)

### 4. Monitoreo Activo — Grafana

**Dashboard de recursos del clúster Kubernetes (CPU y memoria de los pods):**
![Grafana Cluster Monitoring](docs/grafana-dashboard.png)

---

## Informe de Seguridad y Plan de Remediación

Basado en los hallazgos de Snyk y SonarCloud, el plan de acción inmediato es:

| # | Hallazgo | Severidad | Remediación |
|---|---------|-----------|-------------|
| 1 | `mongoose` v8.10.0 — inyección en MongoDB | **Alta** | Actualizar a `mongoose@8.22.1` |
| 2 | `express` + `qs` — DoS/ReDoS | **Alta/Media** | Actualizar a `express@4.22.2`, `body-parser@1.20.5` |
| 3 | 5 Security Hotspots en SonarCloud | **Media** | Revisar hardcoded credentials y config CORS en `server.js` |

---

## Mejoras Implementadas (Retroalimentación del Evaluador)

### 1. Docker Buildx — builds multi-arquitectura en CI

Se agregó el job `docker-build` en `.github/workflows/ci.yml` que corre después de que backend y frontend completan sus validaciones. Usa:
- `docker/setup-qemu-action` para emular arquitecturas ARM
- `docker/setup-buildx-action` como builder multiplataforma
- `docker/build-push-action` con `platforms: linux/amd64,linux/arm64`

Las imágenes se publican con dos tags: `latest` y el SHA del commit para trazabilidad completa.

### 2. Rollback automático en Jenkinsfile

El bloque `post { failure { } }` del `Jenkinsfile` ejecuta automáticamente `kubectl rollout undo` sobre ambos deployments (`api-deployment` y `frontend`) ante cualquier fallo en el pipeline, devolviendo el clúster al último estado estable.

### 3. HEALTHCHECK en Dockerfiles

Ambos Dockerfiles (`backend/Dockerfile` y `frontend/Dockerfile`) incluyen ahora instrucciones `HEALTHCHECK CMD` que permiten a Docker Engine y a Kubernetes detectar contenedores no saludables y reiniciarlos sin intervención manual.

---

## Reflexión sobre la Eficiencia Operativa

La implementación de este pipeline demuestra que una cultura **DevSecOps** integra seguridad y calidad como parte natural del flujo de desarrollo, no como etapas adicionales:

* **Shift Left en Seguridad:** Snyk y SonarCloud detectan vulnerabilidades en el momento del push, antes de que el código llegue a producción. Esto reduce el costo de corrección de fallos hasta 10x respecto a detectarlos en producción.

* **Multi-arquitectura desde CI:** Mediante Docker Buildx y QEMU, las imágenes son compatibles con procesadores ARM (Apple Silicon, Raspberry Pi, instancias AWS Graviton) sin cambios en el código. Esto amplía la portabilidad y reduce costos de infraestructura.

* **Resiliencia con Rollback Automático:** La adición del rollback en el bloque `failure` del Jenkinsfile garantiza que un fallo en cualquier stage del CD nunca deja el clúster en un estado inconsistente. El sistema se recupera sin intervención humana.

* **Observabilidad de Negocio:** Prometheus y Grafana (desplegados con Helm y configurados en `monitoring/`) proveen telemetría en tiempo real. El HPA actúa sobre estas métricas para escalar automáticamente la API entre 1 y 5 réplicas según la carga de CPU.

* **Confianza mediante Tests Reales:** Los 4 tests de integración en `backend/test.js` validan el comportamiento de los endpoints HTTP (incluyendo casos de error 400) sin depender de MongoDB, garantizando que el CI siempre tenga retroalimentación real sobre el estado de la API.
