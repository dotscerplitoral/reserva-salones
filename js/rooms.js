import { normalizeText } from "./utils.js";

export const rooms = [
      { name: "Salón 1", capacity: 50, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 2", capacity: 50, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 3", capacity: 15, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 4", capacity: 50, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 5", capacity: 50, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 6", capacity: 15, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 7", capacity: 15, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 8", capacity: 15, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 9", capacity: 15, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 10", capacity: 15, hasTv: false, accessible: false, type: "salon" },
      { name: "Salón 11", capacity: 35, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 12", capacity: 35, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 13", capacity: 15, hasTv: false, accessible: false, type: "salon" },
      { name: "Salón 14", capacity: 15, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 15", capacity: 15, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 16", capacity: 15, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 17", capacity: 35, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 18", capacity: 35, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 19", capacity: 35, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 20", capacity: 35, hasTv: true, accessible: false, type: "salon" },
      { name: "Salón 21", capacity: 35, hasTv: false, accessible: true, type: "salon" },
      { name: "Salón 22", capacity: 35, hasTv: true, accessible: true, type: "salon" },
      { name: "Salón 23", capacity: 35, hasTv: false, accessible: true, type: "salon" },
      { name: "Mediateca", capacity: 20, hasTv: true, accessible: false, type: "mediateca", aliases: ["Salón 24", "Salon 24"] },
      { name: "Laboratorio de informática", capacity: 30, hasTv: true, accessible: true, type: "laboratorio" },
      { name: "Laboratorio de química", capacity: 20, hasTv: true, accessible: true, type: "laboratorio" },
      { name: "Laboratorio de biología", capacity: 20, hasTv: true, accessible: true, type: "laboratorio" },
      { name: "Laboratorio de física", capacity: 20, hasTv: true, accessible: true, type: "laboratorio" }
    ];

const roomOrder = new Map();
rooms.forEach((room, index) => {
  roomOrder.set(normalizeText(room.name), index);
  (room.aliases || []).forEach(alias => roomOrder.set(normalizeText(alias), index));
});

export function getRoomLabel(room) {
      const tvText = room.hasTv ? "TV" : "sin TV";
      const accessibleText = room.accessible ? " · Accesible" : "";
      return `${room.name} · c${room.capacity} · ${tvText}${accessibleText}`;
    }

export function findRoomInfo(roomName) {
      const normalizedRoomName = normalizeText(roomName);
      return rooms.find(room => normalizeText(room.name) === normalizedRoomName || (room.aliases || []).some(alias => normalizeText(alias) === normalizedRoomName)) || {
        name: roomName || "Sin salón",
        capacity: "-",
        hasTv: false,
        accessible: false,
        type: "otro"
      };
    }

export function roomSortValue(roomName) {
      const normalizedRoomName = normalizeText(roomName);
      if (roomOrder.has(normalizedRoomName)) return roomOrder.get(normalizedRoomName);
      return 999;
    }

export function sortByRoom(a, b) {
      return roomSortValue(a.salon) - roomSortValue(b.salon) ||
        String(a.salon).localeCompare(String(b.salon), "es", { numeric: true });
    }
