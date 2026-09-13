# Reserva de salones – CERP del Litoral

Aplicación web para gestionar la **reserva de salones de los cursos semipresenciales del CERP del Litoral – Sede Salto**.

El sistema permite que los docentes consulten la disponibilidad de salones para viernes y sábados, seleccionen uno o varios bloques horarios y registren una reserva. La información se almacena en **Firebase Firestore** y, al confirmar, el sistema intenta enviar una notificación al correo del docente.

## Flujo para reservar un salón

1. **Seleccionar la fecha**
   - Desde el calendario se elige un viernes o sábado habilitado.

2. **Completar los datos del grupo**
   - Especialidad.
   - Grupo o nivel.
   - Unidad curricular.
   - El sistema muestra las reservas existentes de esa especialidad para la fecha seleccionada.

3. **Seleccionar horario y salón**
   - Se puede elegir uno o varios bloques horarios.
   - El sistema consulta las reservas existentes y muestra únicamente los salones disponibles para todos los horarios seleccionados.
   - Los salones pueden filtrarse por TV, accesibilidad y capacidad.

4. **Completar los datos del docente**
   - Nombre completo.
   - Cédula.
   - Correo electrónico.
   - El correo es validado mediante la lista de docentes autorizados o, cuando corresponde, mediante autenticación con Google.

5. **Confirmar la reserva**
   - Antes de guardar se vuelve a comprobar que el salón continúe disponible.
   - La reserva se registra en Firestore.
   - Se intenta enviar una confirmación por correo electrónico.

Además, desde **Consultar mis reservas** un docente puede buscar las reservas asociadas a su correo. Las reservas que todavía se encuentren dentro del período permitido pueden modificarse o cancelarse.

## Panel de administración

El panel administrativo se encuentra en:

```text
panel.html
```

Si el proyecto está publicado, se accede agregando `/panel.html` al final de la URL del sitio. Al ingresar se presenta una pantalla de acceso antes de mostrar la información administrativa.

### Funciones disponibles para administración

El panel permite:

- Consultar las reservas del **viernes y sábado de la semana**, todas las reservas o un rango de fechas personalizado.
- Buscar por docente, correo, grupo o unidad curricular.
- Visualizar las reservas agrupadas por fecha y salón.
- Identificar de forma destacada las reservas de los sábados que se extienden después de las **13:00**.
- Consultar el total de reservas, las últimas reservas ingresadas y las últimas reservas eliminadas.
- Imprimir un listado compacto de las reservas visibles.
- Gestionar individualmente las reservas aunque varias correspondan al mismo salón y día.
- **Modificar el salón** de una reserva. Antes de realizar el cambio, el sistema verifica que no exista otra reserva con horarios superpuestos en el salón seleccionado.
- **Eliminar una reserva** mediante una confirmación explícita. La eliminación es lógica: la reserva queda marcada como eliminada y conserva su registro para trazabilidad.

## Tecnologías principales

- HTML, CSS y JavaScript.
- Firebase Firestore.
- Firebase Authentication / Google Auth.
- Firebase App Check.
- EmailJS para las notificaciones por correo.

## Archivos principales

```text
index.html        Interfaz para realizar y consultar reservas.
panel.html        Panel de administración.
css/styles.css    Estilos del panel administrativo.
js/app.js         Lógica principal del panel.
js/firebase.js    Configuración y acceso a Firebase.
js/rooms.js       Información de salones y laboratorios.
js/utils.js       Funciones auxiliares.
```
