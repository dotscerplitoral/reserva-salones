import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase.js";
import { rooms, getRoomLabel, findRoomInfo, sortByRoom, roomSortValue } from "./rooms.js";
import {
  addDays,
  escapeHtml,
  formatCompactWeekend,
  formatReadableDate,
  formatShortDate,
  formatShortDateTime,
  formatTeacherShort,
  formatTeachers,
  getLevel,
  getNextFridayAndSaturday,
  getUnifiedTime,
  normalizeText,
  toDateInputValue,
  uniqueValues
} from "./utils.js";

const dateModeFilter = document.getElementById("dateModeFilter");
    const weekendFilter = document.getElementById("weekendFilter");
    const weekendField = document.getElementById("weekendField");
    const fromDateField = document.getElementById("fromDateField");
    const toDateField = document.getElementById("toDateField");
    const fromDateFilter = document.getElementById("fromDateFilter");
    const toDateFilter = document.getElementById("toDateFilter");
    const searchFilter = document.getElementById("searchFilter");
    const statusMessage = document.getElementById("statusMessage");
    const reservationsContainer = document.getElementById("reservationsContainer");
    const printInfo = document.getElementById("printInfo");
    const statsContainer = document.querySelector(".stats");
    const isPanelPage = document.body.dataset.page === "panel";
    const MAX_WEEKEND_SATURDAY = "2026-10-31";

    const manageModal = document.getElementById("manageModal");
    const manageModalBody = document.getElementById("manageModalBody");
    const closeManageModalButton = document.getElementById("closeManageModal");
    const deleteModal = document.getElementById("deleteModal");
    const closeDeleteModalButton = document.getElementById("closeDeleteModal");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    const deleteConfirmInput = document.getElementById("deleteConfirmInput");
    const deleteReservationInfo = document.getElementById("deleteReservationInfo");
    const deleteActionStatus = document.getElementById("deleteActionStatus");

    let reservationPendingDelete = null;


function isVisibleReservation(reserva) {
  const estado = normalizeText(reserva?.estado || "activa");
  return !["cancelada", "cancelado", "eliminada", "eliminado", "deleted", "borrada", "borrado"].includes(estado);
}

function isDeletedReservation(reserva) {
  const estado = normalizeText(reserva?.estado || "");
  return ["eliminada", "eliminado", "deleted", "borrada", "borrado"].includes(estado);
}



function compactReservations(reservas) {
      const grouped = new Map();

      reservas.forEach(reserva => {
        const roomInfo = findRoomInfo(reserva.salon);
        const key = `${reserva.fecha}__${normalizeText(roomInfo.name)}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            fecha: reserva.fecha,
            salon: roomInfo.name,
            roomInfo,
            especialidades: [],
            niveles: [],
            docentes: [],
            unidadesCurriculares: [],
            horarios: [],
            raw: []
          });
        }

        const item = grouped.get(key);
        item.raw.push(reserva);
        item.especialidades.push(reserva.especialidad || "No registrada");
        item.niveles.push(getLevel(reserva));
        item.docentes.push(...formatTeachers(reserva.docenteNombre, reserva.docenteCorreo));
        item.unidadesCurriculares.push(reserva.unidadCurricular || "No registrada");

        if (Array.isArray(reserva.horarios) && reserva.horarios.length > 0) {
          item.horarios.push(getUnifiedTime(reserva.horarios));
        } else {
          item.horarios.push("Sin horario");
        }
      });

      return Array.from(grouped.values()).map(item => ({
        ...item,
        especialidades: uniqueValues(item.especialidades),
        niveles: uniqueValues(item.niveles),
        docentes: uniqueValues(item.docentes),
        unidadesCurriculares: uniqueValues(item.unidadesCurriculares),
        horarios: uniqueValues(item.horarios)
      }));
    }

function populateWeekendFilter() {
      weekendFilter.innerHTML = "";
      weekendFilter.disabled = false;

      const firstWeekend = getNextFridayAndSaturday();
      const options = [];
      const today = new Date();
      const isCurrentWeekend = today.getDay() === 5 || today.getDay() === 6;

      for (let i = 0; i < 20; i++) {
        const friday = addDays(firstWeekend.friday, i * 7);
        const saturday = addDays(firstWeekend.saturday, i * 7);
        if (saturday > MAX_WEEKEND_SATURDAY) break;
        options.push({ friday, saturday });
      }

      if (options.length === 0) {
        const selectOption = document.createElement("option");
        selectOption.value = "";
        selectOption.textContent = "Período finalizado · último bloque 30 y 31/10/2026";
        weekendFilter.appendChild(selectOption);
        weekendFilter.disabled = true;
        return;
      }

      options.forEach((option, index) => {
        const selectOption = document.createElement("option");
        selectOption.value = `${option.friday}|${option.saturday}`;
        const prefix = index === 0 ? (isCurrentWeekend ? "Actual: " : "Próximo: ") : "";
        selectOption.textContent = `${prefix}${formatCompactWeekend(option.friday, option.saturday)}`;
        weekendFilter.appendChild(selectOption);
      });
    }

function getSelectedDateRange() {
      if (dateModeFilter.value === "all") {
        return { from: "", to: "", closed: false };
      }

      if (dateModeFilter.value === "custom") {
        return {
          from: fromDateFilter.value,
          to: toDateFilter.value,
          closed: false
        };
      }

      if (!weekendFilter.value) {
        return { from: "", to: "", closed: true };
      }

      const [from, to] = weekendFilter.value.split("|");
      return { from, to, closed: false };
    }

function updateDateModeView() {
      const mode = dateModeFilter.value;
      weekendField.classList.toggle("isHidden", mode !== "weekend");
      fromDateField.classList.toggle("isHidden", mode !== "custom");
      toDateField.classList.toggle("isHidden", mode !== "custom");
    }

function getStats(reservas) {
      return {
        reservations: reservas.length,
        dates: new Set(reservas.map(r => r.fecha).filter(Boolean)).size,
        rooms: new Set(reservas.map(r => findRoomInfo(r.salon).name).filter(Boolean)).size,
        teachers: new Set(reservas.map(r => normalizeText(r.docenteCorreo || r.docenteNombre)).filter(Boolean)).size
      };
    }

function getReservationCreatedDate(reserva) {
      const possibleDates = [
        reserva.actualizadoEn,
        reserva.creadoEn,
        reserva.createdAt,
        reserva.fechaCreacion,
        reserva.timestamp,
        reserva.created_at,
        reserva.fechaIngreso,
        reserva.ingresadoEn
      ];

      for (const value of possibleDates) {
        if (!value) continue;

        if (typeof value.toDate === "function") {
          const date = value.toDate();
          if (!Number.isNaN(date.getTime())) return date;
        }

        if (typeof value.toMillis === "function") {
          const date = new Date(value.toMillis());
          if (!Number.isNaN(date.getTime())) return date;
        }

        if (typeof value === "object" && typeof value.seconds === "number") {
          const milliseconds = value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
          const date = new Date(milliseconds);
          if (!Number.isNaN(date.getTime())) return date;
        }

        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return date;
      }

      return null;
    }

function getStartOfCurrentWeek() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Semana de ingreso: domingo 00:00 a domingo siguiente 00:00.
      // Esto permite contar quiénes ingresaron reservas entre domingo y sábado.
      today.setDate(today.getDate() - today.getDay());

      return today;
    }

function getEndOfCurrentWeek() {
      const end = getStartOfCurrentWeek();
      end.setDate(end.getDate() + 7);
      return end;
    }

function countReservationsCreatedThisWeek(reservas = []) {
      const start = getStartOfCurrentWeek();
      const end = getEndOfCurrentWeek();

      return reservas.filter(reserva => {
        const createdDate = getReservationCreatedDate(reserva);
        return createdDate && createdDate >= start && createdDate < end;
      }).length;
    }

function getStartOfCurrentDay() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }

function getEndOfCurrentDay() {
      const end = getStartOfCurrentDay();
      end.setDate(end.getDate() + 1);
      return end;
    }

function getStartOfCurrentMonth() {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), 1);
    }

function getEndOfCurrentMonth() {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth() + 1, 1);
    }

function countReservationsCreatedBetween(reservas = [], start, end) {
      return reservas.filter(reserva => {
        const createdDate = getReservationCreatedDate(reserva);
        return createdDate && createdDate >= start && createdDate < end;
      }).length;
    }

function countReservationsCreatedToday(reservas = []) {
      return countReservationsCreatedBetween(reservas, getStartOfCurrentDay(), getEndOfCurrentDay());
    }

function countReservationsCreatedThisMonth(reservas = []) {
      return countReservationsCreatedBetween(reservas, getStartOfCurrentMonth(), getEndOfCurrentMonth());
    }

function countFutureReservationDates(reservas = []) {
      const todayText = toDateInputValue(new Date());
      return new Set(
        reservas
          .map(reserva => reserva.fecha)
          .filter(fecha => fecha && fecha >= todayText)
      ).size;
    }

function getTopUsedRooms(reservas = [], limit = 3) {
      const counts = new Map();

      reservas.forEach(reserva => {
        const roomName = findRoomInfo(reserva.salon).name;
        if (!roomName || roomName === "Sin salón") return;
        counts.set(roomName, (counts.get(roomName) || 0) + 1);
      });

      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || roomSortValue(a[0]) - roomSortValue(b[0]) || a[0].localeCompare(b[0], "es", { numeric: true }))
        .slice(0, limit)
        .map(([roomName, count]) => ({ roomName, count }));
    }

function getMostUsedRoom(reservas = []) {
      const topRooms = getTopUsedRooms(reservas, 1);
      return topRooms.length ? topRooms[0].roomName : "Sin datos";
    }

function renderTopUsedRooms(reservas = []) {
      const topRooms = getTopUsedRooms(reservas, 3);

      if (topRooms.length === 0) {
        return `<small>Sin datos</small>`;
      }

      return topRooms.map((room, index) => {
        const label = index === 0 ? "Más usado" : `${index + 1}.º más usado`;
        const reservationText = `${room.count} 🔒`;
        return `<small>${label}: <strong>${escapeHtml(room.roomName)}</strong> · <span class="roomCount">${reservationText}</span></small>`;
      }).join("");
    }

function getLatestReservations(reservas = [], limit = 3) {
      return [...reservas]
        .map(reserva => ({ reserva, createdDate: getReservationCreatedDate(reserva) }))
        .filter(item => item.createdDate)
        .sort((a, b) => b.createdDate - a.createdDate)
        .slice(0, limit)
        .map(item => item.reserva);
    }

function renderLatestReservations(reservas = []) {
      const latestReservations = getLatestReservations(reservas, 3);

      if (latestReservations.length === 0) {
        return `<small>No se encontró fecha/hora de ingreso en las reservas.</small>`;
      }

      return latestReservations.map(reserva => {
        const createdDate = getReservationCreatedDate(reserva);
        const teacher = formatTeacherShort(reserva.docenteNombre, reserva.docenteCorreo);
        const especialidad = reserva.especialidad || "Sin especialidad";
        const reservationDate = formatShortDate(reserva.fecha);
        const roomName = findRoomInfo(reserva.salon).name;

        return `
          <small class="entryItem"><span class="entryDate">${escapeHtml(formatShortDateTime(createdDate))}</span> · <strong>${escapeHtml(teacher)}</strong> · ${escapeHtml(especialidad)} · Reserva: ${escapeHtml(reservationDate)} · ${escapeHtml(roomName)}</small>
        `;
      }).join("");
    }

function getDeletedDate(reserva) {
      const value = reserva?.eliminadoEn || reserva?.deletedAt || reserva?.borradoEn;
      if (!value) return null;

      if (typeof value.toDate === "function") {
        const date = value.toDate();
        if (!Number.isNaN(date.getTime())) return date;
      }

      if (typeof value.toMillis === "function") {
        const date = new Date(value.toMillis());
        if (!Number.isNaN(date.getTime())) return date;
      }

      if (typeof value === "object" && typeof value.seconds === "number") {
        const milliseconds = value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
        const date = new Date(milliseconds);
        if (!Number.isNaN(date.getTime())) return date;
      }

      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }

function getLatestDeletedReservations(reservas = [], limit = 3) {
      return reservas
        .filter(isDeletedReservation)
        .map(reserva => ({ reserva, deletedDate: getDeletedDate(reserva) }))
        .filter(item => item.deletedDate)
        .sort((a, b) => b.deletedDate - a.deletedDate)
        .slice(0, limit)
        .map(item => item.reserva);
    }

function renderLatestDeletedReservations(reservas = []) {
      const deleted = getLatestDeletedReservations(reservas, 3);

      if (deleted.length === 0) {
        return `<small>No hay reservas eliminadas registradas.</small>`;
      }

      return deleted.map(reserva => {
        const deletedDate = getDeletedDate(reserva);
        const teacher = formatTeacherShort(reserva.docenteNombre, reserva.docenteCorreo);
        const roomName = findRoomInfo(reserva.salon).name;
        const reservationDate = formatShortDate(reserva.fecha);

        return `
          <small class="entryItem deletedEntry"><span class="entryDate">${escapeHtml(formatShortDateTime(deletedDate))}</span> · <strong>${escapeHtml(teacher)}</strong> · ${escapeHtml(roomName)} · Reserva: ${escapeHtml(reservationDate)}</small>
        `;
      }).join("");
    }

function getLatestFirstTimeTeachers(reservas = [], limit = 3) {
      const teachers = new Map();

      reservas.forEach(reserva => {
        const teacherName = formatTeacherShort(reserva.docenteNombre, reserva.docenteCorreo);
        const key = normalizeText(reserva.docenteCorreo || reserva.docenteNombre || teacherName);
        const firstDate = getReservationCreatedDate(reserva);

        if (!key || !teacherName || teacherName === "Sin docente" || !firstDate) return;

        const previous = teachers.get(key);
        if (!previous || firstDate < previous.firstDate) {
          teachers.set(key, {
            teacherName,
            firstDate
          });
        }
      });

      return Array.from(teachers.values())
        .sort((a, b) => b.firstDate - a.firstDate)
        .slice(0, limit);
    }

function renderLatestRegisteredTeachers(reservas = []) {
      const latestTeachers = getLatestFirstTimeTeachers(reservas, 3);

      if (latestTeachers.length === 0) {
        return `<small>Sin datos</small>`;
      }

      return latestTeachers.map(teacher => `<small><strong>${escapeHtml(teacher.teacherName)}</strong> · <span class="teacherDate">${escapeHtml(formatShortDateTime(teacher.firstDate))}</span></small>`).join("");
    }

function renderStats(reservas, reservasTotales = [], todasLasReservas = []) {
      const dataForGlobalStats = reservasTotales.length ? reservasTotales : reservas;
      const currentStats = getStats(reservas);
      const globalStats = getStats(dataForGlobalStats);
      const createdToday = countReservationsCreatedToday(dataForGlobalStats);
      const createdThisWeek = countReservationsCreatedThisWeek(dataForGlobalStats);
      const createdThisMonth = countReservationsCreatedThisMonth(dataForGlobalStats);

      document.getElementById("totalReservations").textContent = currentStats.reservations;
      document.getElementById("totalReservationsGlobal").innerHTML = `
        Total general: ${globalStats.reservations}
        <div class="weeklyIncomeText">
          <div class="incomeLine">+${createdToday} día</div>
          <div class="incomeLine">+${createdThisWeek} semana</div>
          <div class="incomeLine">+${createdThisMonth} mes</div>
        </div>
      `;
      document.getElementById("latestReservationsInfo").innerHTML = renderLatestReservations(dataForGlobalStats);
      const deletedStats = todasLasReservas.length ? todasLasReservas : reservasTotales;
      const deletedContainer = document.getElementById("latestDeletedReservationsInfo");
      if (deletedContainer) {
        deletedContainer.innerHTML = renderLatestDeletedReservations(deletedStats);
      }
    }

function renderRoomTags(roomInfo) {
      const tags = [`c${roomInfo.capacity}`];
      tags.push(roomInfo.hasTv ? "TV" : "Sin TV");
      if (roomInfo.accessible) tags.push("Accesible");

      return tags.map(tag => `<span class="miniTag">${escapeHtml(tag)}</span>`).join("");
    }

function parseTimeToMinutes(value) {
      const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
      if (!match) return null;
      return Number(match[1]) * 60 + Number(match[2]);
    }

function parseTimeRange(slot) {
      const [startText, endText] = String(slot || "").split(" - ");
      const start = parseTimeToMinutes(startText);
      const end = parseTimeToMinutes(endText);
      if (start === null || end === null) return null;
      return { start, end };
    }

function reservationsOverlap(first, second) {
      const firstSlots = Array.isArray(first?.horarios) ? first.horarios : [];
      const secondSlots = Array.isArray(second?.horarios) ? second.horarios : [];

      if (!firstSlots.length || !secondSlots.length) return true;

      return firstSlots.some(firstSlot => {
        const a = parseTimeRange(firstSlot);
        if (!a) return true;
        return secondSlots.some(secondSlot => {
          const b = parseTimeRange(secondSlot);
          if (!b) return true;
          return a.start < b.end && b.start < a.end;
        });
      });
    }

function isSaturdayAfterOne(reserva) {
      if (!reserva?.fecha) return false;
      const date = new Date(`${reserva.fecha}T00:00:00`);
      if (date.getDay() !== 6) return false;

      const slots = Array.isArray(reserva.horarios) ? reserva.horarios : [];
      return slots.some(slot => {
        const range = parseTimeRange(slot);
        if (!range) return false;
        return range.start >= 13 * 60 || range.end > 13 * 60;
      });
    }

function isLateSaturdayGroup(data) {
      return Array.isArray(data?.raw) && data.raw.some(isSaturdayAfterOne);
    }

function buildRoomOptions(selectedRoomName) {
      const selectedCanonical = findRoomInfo(selectedRoomName).name;
      return rooms.map(room => {
        const selected = room.name === selectedCanonical ? " selected" : "";
        return `<option value="${escapeHtml(room.name)}"${selected}>${escapeHtml(getRoomLabel(room))}</option>`;
      }).join("");
    }

function closeManageModal() {
      if (!manageModal) return;
      manageModal.classList.add("isHidden");
      manageModalBody.innerHTML = "";
    }

function closeDeleteModal() {
      if (!deleteModal) return;
      deleteModal.classList.add("isHidden");
      reservationPendingDelete = null;
      deleteConfirmInput.value = "";
      deleteActionStatus.textContent = "";
      confirmDeleteBtn.disabled = true;
    }

async function validateRoomAvailability(reserva, targetRoom) {
      const daySnapshot = await getDocs(query(collection(db, "reservas"), where("fecha", "==", reserva.fecha)));
      const targetCanonical = findRoomInfo(targetRoom).name;

      return daySnapshot.docs
        .map(snapshotDoc => ({ id: snapshotDoc.id, ...snapshotDoc.data() }))
        .filter(isVisibleReservation)
        .filter(other => other.id !== reserva.id)
        .filter(other => findRoomInfo(other.salon).name === targetCanonical)
        .find(other => reservationsOverlap(reserva, other)) || null;
    }

async function changeReservationRoom(reserva, targetRoom, statusElement, button) {
      const currentRoom = findRoomInfo(reserva.salon).name;
      const targetCanonical = findRoomInfo(targetRoom).name;

      if (currentRoom === targetCanonical) {
        statusElement.textContent = "La reserva ya está asignada a ese salón.";
        statusElement.className = "actionStatus";
        return;
      }

      button.disabled = true;
      statusElement.textContent = "Verificando disponibilidad...";
      statusElement.className = "actionStatus";

      try {
        const conflict = await validateRoomAvailability(reserva, targetCanonical);
        if (conflict) {
          const conflictTeacher = formatTeachers(conflict.docenteNombre, conflict.docenteCorreo).join(", ");
          statusElement.textContent = `No se puede cambiar: ${targetCanonical} ya está reservado en un horario que se superpone${conflictTeacher ? ` (${conflictTeacher})` : ""}.`;
          statusElement.className = "actionStatus errorStatus";
          return;
        }

        await updateDoc(doc(db, "reservas", reserva.id), {
          salon: targetCanonical,
          modificadoEn: serverTimestamp()
        });

        statusElement.textContent = `Salón actualizado a ${targetCanonical}.`;
        statusElement.className = "actionStatus successStatus";
        reserva.salon = targetCanonical;
        await loadReservations();
        closeManageModal();
      } catch (error) {
        console.error("Error al modificar salón:", error);
        statusElement.textContent = "No se pudo modificar el salón. Revisá los permisos de Firestore.";
        statusElement.className = "actionStatus errorStatus";
      } finally {
        button.disabled = false;
      }
    }

function openDeleteConfirmation(reserva) {
      if (!deleteModal) return;
      reservationPendingDelete = reserva;
      const teacher = formatTeachers(reserva.docenteNombre, reserva.docenteCorreo).join(", ") || "Sin docente";
      const room = findRoomInfo(reserva.salon).name;
      deleteReservationInfo.textContent = `${formatReadableDate(reserva.fecha)} · ${room} · ${teacher} · ${getUnifiedTime(reserva.horarios)}`;
      deleteConfirmInput.value = "";
      deleteActionStatus.textContent = "";
      confirmDeleteBtn.disabled = true;
      deleteModal.classList.remove("isHidden");
      setTimeout(() => deleteConfirmInput.focus(), 0);
    }

async function confirmDeleteReservation() {
      if (!reservationPendingDelete || normalizeText(deleteConfirmInput.value) !== "eliminar") return;

      confirmDeleteBtn.disabled = true;
      deleteActionStatus.textContent = "Eliminando reserva...";
      deleteActionStatus.className = "actionStatus";

      try {
        await updateDoc(doc(db, "reservas", reservationPendingDelete.id), {
          estado: "eliminada",
          eliminadoEn: serverTimestamp()
        });

        closeDeleteModal();
        closeManageModal();
        await loadReservations();
      } catch (error) {
        console.error("Error al eliminar reserva:", error);
        deleteActionStatus.textContent = "No se pudo eliminar la reserva. Revisá los permisos de Firestore.";
        deleteActionStatus.className = "actionStatus errorStatus";
        confirmDeleteBtn.disabled = false;
      }
    }

function openManageModal(reservas) {
      if (!manageModal || !manageModalBody) return;

      manageModalBody.innerHTML = reservas.map((reserva, index) => {
        const teacher = formatTeachers(reserva.docenteNombre, reserva.docenteCorreo).join(", ") || "Sin docente";
        const room = findRoomInfo(reserva.salon).name;
        return `
          <section class="manageReservationCard" data-reservation-id="${escapeHtml(reserva.id)}">
            <div class="manageReservationInfo">
              <strong>${escapeHtml(teacher)}</strong>
              <small>${escapeHtml(reserva.especialidad || "Sin especialidad")} · ${escapeHtml(getLevel(reserva))}</small>
              <small>${escapeHtml(formatReadableDate(reserva.fecha))} · ${escapeHtml(getUnifiedTime(reserva.horarios))}</small>
            </div>
            <div class="manageRoomField">
              <label for="roomChange_${index}">Salón</label>
              <select id="roomChange_${index}" class="roomChangeSelect">${buildRoomOptions(room)}</select>
            </div>
            <div class="manageActionButtons">
              <button type="button" class="smallActionBtn saveRoomBtn">Guardar salón</button>
              <button type="button" class="smallActionBtn dangerAction deleteReservationBtn">Eliminar</button>
            </div>
            <p class="actionStatus" aria-live="polite"></p>
          </section>
        `;
      }).join("");

      const cards = manageModalBody.querySelectorAll(".manageReservationCard");
      cards.forEach((card, index) => {
        const reserva = reservas[index];
        const select = card.querySelector(".roomChangeSelect");
        const saveButton = card.querySelector(".saveRoomBtn");
        const deleteButton = card.querySelector(".deleteReservationBtn");
        const actionStatus = card.querySelector(".actionStatus");

        saveButton.addEventListener("click", () => changeReservationRoom(reserva, select.value, actionStatus, saveButton));
        deleteButton.addEventListener("click", () => openDeleteConfirmation(reserva));
      });

      manageModal.classList.remove("isHidden");
    }

function renderReservations(reservas, reservasTotales = [], todasLasReservas = []) {
      reservationsContainer.innerHTML = "";
      renderStats(reservas, reservasTotales, todasLasReservas);

      const compactadas = compactReservations(reservas);
      updatePrintInfo(compactadas.length);

      if (compactadas.length === 0) {
        reservationsContainer.innerHTML = `<div class="empty">No hay reservas para los filtros seleccionados.</div>`;
        const selectedRange = getSelectedDateRange();
        statusMessage.textContent = selectedRange.closed
          ? "El período de reservas de viernes y sábado finalizó el 31/10/2026."
          : "Sin resultados para mostrar.";
        return;
      }

      statusMessage.textContent = `Mostrando ${compactadas.length} fila(s) agrupadas a partir de ${reservas.length} reserva(s).`;

      const grouped = compactadas.reduce((acc, reserva) => {
        if (!acc[reserva.fecha]) acc[reserva.fecha] = [];
        acc[reserva.fecha].push(reserva);
        return acc;
      }, {});

      Object.keys(grouped).sort().forEach(fecha => {
        const reservasDelDia = grouped[fecha].sort(sortByRoom);

        const group = document.createElement("article");
        group.className = "dayGroup";
        group.innerHTML = `
          <div class="dayHeader">
            <h2>${escapeHtml(formatReadableDate(fecha))}</h2>
            <span class="badge">${reservasDelDia.length} espacio(s)</span>
          </div>
          <div class="reservationList"></div>
        `;

        const list = group.querySelector(".reservationList");

        reservasDelDia.forEach(data => {
          const roomInfo = data.roomInfo || findRoomInfo(data.salon);
          const lateSaturday = isLateSaturdayGroup(data);
          const item = document.createElement("article");
          item.className = `reservationItem${lateSaturday ? " saturdayLate" : ""}`;
          item.innerHTML = `
            <div class="summaryGrid${isPanelPage ? " withActions" : ""}">
              <div class="roomBlock">
                <strong>${escapeHtml(roomInfo.name)}</strong>
                <div class="roomMeta">
                  ${renderRoomTags(roomInfo)}
                  ${lateSaturday ? `<span class="miniTag lateSaturdayTag">Sábado después de 13:00</span>` : ""}
                </div>
              </div>

              <div class="mainData">
                <span>Especialidad</span>
                <strong>${escapeHtml(data.especialidades.join(" / "))}</strong>
              </div>

              <div class="mainData">
                <span>Nivel</span>
                <strong>${escapeHtml(data.niveles.join(" / "))}</strong>
              </div>

              <div class="mainData">
                <span>Docente/s</span>
                <small class="smallText">${escapeHtml(data.docentes.join(", "))}</small>
              </div>

              <div class="mainData unitData">
                <span>Unidad curricular</span>
                <small>${escapeHtml(data.unidadesCurriculares.join(" / "))}</small>
              </div>

              <div class="mainData">
                <span>Horario reservado</span>
                <div>${data.horarios.map(horario => `<span class="timePill">${escapeHtml(horario)}</span>`).join("")}</div>
              </div>

              ${isPanelPage ? `
                <div class="mainData actionData noPrint">
                  <span>Acciones</span>
                  <button type="button" class="manageBtn">Gestionar${data.raw.length > 1 ? ` (${data.raw.length})` : ""}</button>
                </div>
              ` : ""}
            </div>
          `;

          if (isPanelPage) {
            item.querySelector(".manageBtn")?.addEventListener("click", () => openManageModal(data.raw));
          }

          list.appendChild(item);
        });

        reservationsContainer.appendChild(group);
      });
    }

function updatePrintInfo(total) {
      const filters = [];

      const selectedRange = getSelectedDateRange();

      if (dateModeFilter.value === "all") {
        filters.push("Fechas: todas las reservas");
      } else if (selectedRange.closed) {
        filters.push("Viernes y sábado: período finalizado el 31/10/2026");
      } else if (selectedRange.from || selectedRange.to) {
        filters.push(`Fechas: ${selectedRange.from ? formatReadableDate(selectedRange.from) : "inicio"} a ${selectedRange.to ? formatReadableDate(selectedRange.to) : "fin"}`);
      }


      if (searchFilter.value.trim()) {
        filters.push(`Búsqueda: ${searchFilter.value.trim()}`);
      }

      const filterText = filters.length > 0 ? filters.join(" · ") : "Sin filtros aplicados";
      printInfo.textContent = `CERP del Litoral · Sede Salto · ${total} reserva(s) · ${filterText}`;
    }

function showLoadingState() {
      statusMessage.className = "message";
      statusMessage.textContent = "Cargando reservas...";

      if (statsContainer) {
        statsContainer.classList.add("isLoading");
      }

      reservationsContainer.innerHTML = `
        <div class="loadingBox" aria-label="Cargando datos">
          <div class="loadingCard"></div>
          <div class="loadingCard"></div>
          <div class="loadingCard"></div>
        </div>
      `;
    }

function hideLoadingState() {
      if (statsContainer) {
        statsContainer.classList.remove("isLoading");
      }
    }

async function loadReservations() {
      showLoadingState();

      try {
        let q;
        const selectedRange = getSelectedDateRange();
        const selectedFromDate = selectedRange.from;
        const selectedToDate = selectedRange.to;

        if (selectedRange.closed) {
          q = query(collection(db, "reservas"), where("fecha", "==", "9999-12-31"));
        } else if (selectedFromDate && selectedToDate) {
          q = query(collection(db, "reservas"), where("fecha", ">=", selectedFromDate), where("fecha", "<=", selectedToDate));
        } else if (selectedFromDate) {
          q = query(collection(db, "reservas"), where("fecha", ">=", selectedFromDate));
        } else if (selectedToDate) {
          q = query(collection(db, "reservas"), where("fecha", "<=", selectedToDate));
        } else {
          q = query(collection(db, "reservas"));
        }

        const [snapshot, totalSnapshot] = await Promise.all([
          getDocs(q),
          getDocs(collection(db, "reservas"))
        ]);

        let reservas = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(isVisibleReservation);

        const todasLasReservas = totalSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }));

        const reservasTotales = todasLasReservas.filter(isVisibleReservation);

        const search = normalizeText(searchFilter.value);

        if (search) {
          reservas = reservas.filter(r => {
            const roomInfo = findRoomInfo(r.salon);
            const fullText = normalizeText([
              r.docenteNombre,
              r.docenteCorreo,
              r.docenteCedula,
              r.grupo,
              r.nivel,
              r.especialidad,
              r.unidadCurricular,
              r.salon,
              roomInfo.capacity,
              roomInfo.hasTv ? "tv" : "sin tv",
              roomInfo.accessible ? "accesible" : "",
              Array.isArray(r.horarios) ? r.horarios.join(" ") : ""
            ].join(" "));
            return fullText.includes(search);
          });
        }

        reservas.sort((a, b) => {
          const fechaCompare = String(a.fecha).localeCompare(String(b.fecha));
          if (fechaCompare !== 0) return fechaCompare;

          const horarioA = Array.isArray(a.horarios) ? a.horarios[0] : "";
          const horarioB = Array.isArray(b.horarios) ? b.horarios[0] : "";
          return horarioA.localeCompare(horarioB) || String(a.salon).localeCompare(String(b.salon), "es", { numeric: true });
        });

        hideLoadingState();
        renderReservations(reservas, reservasTotales, todasLasReservas);
      } catch (error) {
        hideLoadingState();
        console.error("Error al cargar reservas:", error);
        statusMessage.className = "message error";
        statusMessage.textContent = "Error al cargar reservas: " + error.message;
      }
    }

function printReservations() {
      window.print();
    }

window.loadReservations = loadReservations;
    window.printReservations = printReservations;

    dateModeFilter.addEventListener("change", () => {
      updateDateModeView();
      loadReservations();
    });
    weekendFilter.addEventListener("change", loadReservations);
    fromDateFilter.addEventListener("change", loadReservations);
    toDateFilter.addEventListener("change", loadReservations);
    searchFilter.addEventListener("input", () => {
      clearTimeout(window.__searchTimer);
      window.__searchTimer = setTimeout(loadReservations, 350);
    });

    if (isPanelPage) {
      closeManageModalButton?.addEventListener("click", closeManageModal);
      closeDeleteModalButton?.addEventListener("click", closeDeleteModal);
      cancelDeleteBtn?.addEventListener("click", closeDeleteModal);
      confirmDeleteBtn?.addEventListener("click", confirmDeleteReservation);

      deleteConfirmInput?.addEventListener("input", () => {
        confirmDeleteBtn.disabled = normalizeText(deleteConfirmInput.value) !== "eliminar";
      });

      manageModal?.addEventListener("click", event => {
        if (event.target === manageModal) closeManageModal();
      });

      deleteModal?.addEventListener("click", event => {
        if (event.target === deleteModal) closeDeleteModal();
      });

      document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        if (deleteModal && !deleteModal.classList.contains("isHidden")) {
          closeDeleteModal();
        } else if (manageModal && !manageModal.classList.contains("isHidden")) {
          closeManageModal();
        }
      });
    }

    populateWeekendFilter();
    updateDateModeView();

    const defaultWeek = getNextFridayAndSaturday();
    fromDateFilter.value = defaultWeek.friday;
    toDateFilter.value = defaultWeek.saturday;

    loadReservations();
