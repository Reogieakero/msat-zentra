"use client";

import * as React from "react";
import * as THREE from "three";
import { useTheme } from "@/components/providers";
import { roleLabel } from "@/lib/auth/roles";
import type { AdminPresenceUser } from "@/services/admin/admin.service";
import {
  LAND_MASK_BASE64,
  LAND_MASK_HEIGHT,
  LAND_MASK_WIDTH,
} from "./land-mask";
import { roleColor } from "./role-colors";
import styles from "./presence-globe.module.css";

const RADIUS = 2.6;

/* Landmass palette. Dark mode keeps the emerald fill + teal coastline; light
   mode swaps them for amber so the dots still read on the pale shell and match
   the amber login chart on the same board. The land fill is a deeper amber than
   the amber role marker so the two layers stay distinct. */
const GLOBE_COLORS = {
  dark: { land: "#10b981", coast: "#34d399" },
  light: { land: "#b45309", coast: "#f59e0b" },
} as const;

function latLngToVector3(lat: number, lng: number, radius = RADIUS): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function decodeMask(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isLand(mask: Uint8Array, x: number, y: number): boolean {
  if (y < 0 || y >= LAND_MASK_HEIGHT) return false;
  const wx = ((x % LAND_MASK_WIDTH) + LAND_MASK_WIDTH) % LAND_MASK_WIDTH;
  const index = y * LAND_MASK_WIDTH + wx;
  return (mask[index >> 3] & (1 << (index & 7))) !== 0;
}

/**
 * Land particles from the 1° mask.
 *
 * An equirectangular grid packs far more cells per unit area near the poles, so
 * a naive one-point-per-cell render produces the dense dotted rings the globe
 * used to show at the top/bottom. Cells are therefore accepted with a
 * probability proportional to cos(latitude) and get 1–3 jittered dots, which
 * keeps the surface density even and makes the continents read as filled
 * landmasses. Coastline cells go into their own brighter layer so the outline
 * still reads through the fill.
 */
function buildLandLayers(): { land: Float32Array; coast: Float32Array } {
  const mask = decodeMask(LAND_MASK_BASE64);
  const land: number[] = [];
  const coast: number[] = [];

  for (let y = 0; y < LAND_MASK_HEIGHT; y += 1) {
    const cellLat = 90 - ((y + 0.5) / LAND_MASK_HEIGHT) * 180;
    // Skip the last couple of degrees at each pole: equirectangular rows there
    // collapse to a point, and Antarctica's interior would just form a blob.
    if (Math.abs(cellLat) > 82) continue;
    // 1 at the equator, 0 at the poles.
    const areaWeight = Math.cos((cellLat * Math.PI) / 180);

    for (let x = 0; x < LAND_MASK_WIDTH; x += 1) {
      if (!isLand(mask, x, y)) continue;

      const baseHash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      // Thin out polar cells so the far-north/far-south rows don't collapse
      // into a single bright ring.
      if ((baseHash & 0xffff) / 0xffff > areaWeight) continue;

      const onCoast =
        !isLand(mask, x - 1, y) ||
        !isLand(mask, x + 1, y) ||
        !isLand(mask, x, y - 1) ||
        !isLand(mask, x, y + 1);
      // More dots per cell near the equator, where 1° covers the most surface.
      const perCell = onCoast ? 1 : areaWeight > 0.6 ? 3 : areaWeight > 0.3 ? 2 : 1;
      const target = onCoast ? coast : land;

      for (let k = 0; k < perCell; k += 1) {
        const hash = (baseHash ^ (k * 2654435761)) >>> 0;
        const jx = ((hash & 0xff) / 255 - 0.5) * 0.9;
        const jy = (((hash >>> 8) & 0xff) / 255 - 0.5) * 0.9;
        const lat = cellLat + (jy * 180) / LAND_MASK_HEIGHT;
        const lng = -180 + ((x + 0.5 + jx) / LAND_MASK_WIDTH) * 360;
        const point = latLngToVector3(lat, lng, RADIUS * 1.002);
        target.push(point.x, point.y, point.z);
      }
    }
  }

  return { land: new Float32Array(land), coast: new Float32Array(coast) };
}

function activeAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "time unavailable";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface TooltipState {
  user: AdminPresenceUser;
  x: number;
  y: number;
}

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl")),
    );
  } catch {
    return false;
  }
}

export default function PresenceGlobe({ users }: { users: AdminPresenceUser[] }) {
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const syncRef = React.useRef<((next: AdminPresenceUser[]) => void) | null>(null);
  const landMaterialRef = React.useRef<THREE.PointsMaterial | null>(null);
  const coastMaterialRef = React.useRef<THREE.PointsMaterial | null>(null);
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === "dark";
  const [tooltip, setTooltip] = React.useState<TooltipState | null>(null);
  // The globe is client-only (dynamic import, ssr:false), so this can be
  // resolved during the first render instead of setState-in-effect.
  const [webglMissing] = React.useState(
    () => typeof document !== "undefined" && !supportsWebGl(),
  );

  // Scene is built once; data changes are applied through `syncRef`.
  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount || webglMissing) return;
    const el: HTMLDivElement = mount;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      el.textContent = "Live globe is unavailable in this browser.";
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.35, 7.4);
    camera.lookAt(0, 0, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    // --- particle landmasses -------------------------------------------------
    const globe = new THREE.Group();
    globe.rotation.z = 0.28;
    scene.add(globe);

    // Push the globe to the right of the viewport instead of dead centre. The
    // offset is a fraction of the visible width, so it holds while zooming and
    // on narrow screens.
    function shiftGlobe() {
      const halfWidth =
        Math.abs(camera.position.z) *
        Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) *
        camera.aspect;
      globe.position.x = halfWidth * 0.22;
    }
    shiftGlobe();

    const { land, coast } = buildLandLayers();
    const initialPalette = document.documentElement.classList.contains("dark")
      ? GLOBE_COLORS.dark
      : GLOBE_COLORS.light;

    const landGeometry = new THREE.BufferGeometry();
    landGeometry.setAttribute("position", new THREE.BufferAttribute(land, 3));
    const landMaterial = new THREE.PointsMaterial({
      // Landmass fill: a deeper shade so the brighter coastline still reads on
      // top of it (emerald in dark mode, amber in light mode).
      color: initialPalette.land,
      size: 0.021,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    landMaterialRef.current = landMaterial;
    globe.add(new THREE.Points(landGeometry, landMaterial));

    const coastGeometry = new THREE.BufferGeometry();
    coastGeometry.setAttribute("position", new THREE.BufferAttribute(coast, 3));
    const coastMaterial = new THREE.PointsMaterial({
      color: initialPalette.coast,
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    coastMaterialRef.current = coastMaterial;
    globe.add(new THREE.Points(coastGeometry, coastMaterial));

    // Depth-only sphere: hides the dots (and markers) on the far side so the
    // globe reads as a sphere rather than a disc of points.
    const occluderGeometry = new THREE.SphereGeometry(RADIUS * 0.985, 48, 32);
    const occluderMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
    });
    globe.add(new THREE.Mesh(occluderGeometry, occluderMaterial));

    // --- markers -------------------------------------------------------------
    const markerGroup = new THREE.Group();
    globe.add(markerGroup);
    let hitMeshes: THREE.Mesh[] = [];

    function disposeGroup(group: THREE.Group) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
          child.geometry.dispose();
          const material = child.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      group.clear();
    }

    function sync(next: AdminPresenceUser[]) {
      disposeGroup(markerGroup);
      hitMeshes = [];
      for (const user of next) {
        const position = latLngToVector3(user.lat, user.lng);
        const color = roleColor(user.role);

        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 12, 12),
          new THREE.MeshBasicMaterial({ color }),
        );
        core.position.copy(position);

        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 12, 12),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
          }),
        );
        halo.position.copy(position);

        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 8, 8),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
        );
        hit.position.copy(position);
        hit.userData.user = user;
        hitMeshes.push(hit);

        markerGroup.add(core, halo, hit);
      }
    }
    syncRef.current = sync;
    sync(users);

    // --- resize --------------------------------------------------------------
    let width = el.clientWidth || 1;
    let height = el.clientHeight || 1;
    function resize() {
      width = el.clientWidth || 1;
      height = el.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      shiftGlobe();
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    // --- interaction ---------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false;
    let lastX = 0;
    let velocity = 0;
    let hoveredId: string | null = null;
    let lastTooltipAt = 0;

    // Zoom is a scale on the camera's distance from the origin (below 1 = closer).
    const CAMERA_BASE = new THREE.Vector3(0, 0.35, 7.4);
    const MIN_ZOOM = 0.55;
    const MAX_ZOOM = 1.75;
    let zoom = 1;
    function applyZoom(next: number) {
      zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      camera.position.copy(CAMERA_BASE).multiplyScalar(zoom);
      camera.lookAt(0, 0, 0);
      shiftGlobe();
    }
    applyZoom(1);

    // Track every active pointer so a two-finger pinch can zoom the globe.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStartDistance = 0;
    let pinchStartZoom = 1;

    function pointerDistance(): number {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function pick(clientX: number, clientY: number): AdminPresenceUser | null {
      const rect = el.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      // Ignore far-side markers: they are hidden by the depth-only sphere.
      const hit = raycaster
        .intersectObjects(hitMeshes, false)
        .find((candidate) => candidate.point.dot(camera.position) > 0);
      return (hit?.object.userData.user as AdminPresenceUser | undefined) ?? null;
    }

    function onPointerMove(event: PointerEvent) {
      if (pointers.has(event.pointerId)) {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      // Two fingers = pinch to zoom; don't also spin the globe.
      if (pointers.size === 2) {
        const distance = pointerDistance();
        if (pinchStartDistance > 0 && distance > 0) {
          applyZoom(pinchStartZoom * (pinchStartDistance / distance));
        }
        return;
      }

      if (dragging) {
        const dx = event.clientX - lastX;
        lastX = event.clientX;
        globe.rotation.y += dx * 0.005;
        velocity = dx * 0.005;
      }
      const user = pick(event.clientX, event.clientY);
      if (!user) {
        if (hoveredId) {
          hoveredId = null;
          setTooltip(null);
          el.style.cursor = dragging ? "grabbing" : "grab";
        }
        return;
      }
      el.style.cursor = "pointer";
      // Re-render at most ~12x/s while the cursor follows the same marker.
      const now = performance.now();
      if (hoveredId === user.id && now - lastTooltipAt < 80) return;
      hoveredId = user.id;
      lastTooltipAt = now;
      const rect = el.getBoundingClientRect();
      setTooltip({
        user,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }

    function onPointerDown(event: PointerEvent) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      el.setPointerCapture?.(event.pointerId);
      if (pointers.size === 2) {
        dragging = false;
        pinchStartDistance = pointerDistance();
        pinchStartZoom = zoom;
        el.style.cursor = "grabbing";
        return;
      }
      dragging = true;
      lastX = event.clientX;
      velocity = 0;
      el.style.cursor = "grabbing";
    }

    function onPointerUp(event: PointerEvent) {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchStartDistance = 0;
      if (pointers.size === 1) {
        const [remaining] = [...pointers.values()];
        dragging = true;
        lastX = remaining.x;
        velocity = 0;
      } else if (pointers.size === 0) {
        dragging = false;
        el.style.cursor = "grab";
      }
    }

    function onPointerLeave() {
      pointers.clear();
      dragging = false;
      hoveredId = null;
      setTooltip(null);
      el.style.cursor = "grab";
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      // Mouse wheel and trackpad pinch both land here; ctrlKey marks the latter.
      const factor = Math.exp(event.deltaY * (event.ctrlKey ? 0.01 : 0.0012));
      applyZoom(zoom * factor);
    }

    el.style.cursor = "grab";
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("wheel", onWheel, { passive: false });

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- animation -----------------------------------------------------------
    let frame = 0;
    let lastTime = performance.now();
    function animate(time: number) {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(64, time - lastTime) / 16.67;
      lastTime = time;
      if (document.hidden) return;

      if (!dragging) {
        velocity *= 0.93;
        if (!reduceMotion) globe.rotation.y += 0.0016 * delta + velocity;
        else if (Math.abs(velocity) > 0.0001) globe.rotation.y += velocity;
      }
      globe.rotation.x = Math.sin(time * 0.00008) * 0.06;
      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("wheel", onWheel);
      syncRef.current = null;
      landMaterialRef.current = null;
      coastMaterialRef.current = null;
      disposeGroup(markerGroup);
      landGeometry.dispose();
      landMaterial.dispose();
      coastGeometry.dispose();
      coastMaterial.dispose();
      occluderGeometry.dispose();
      occluderMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // Scene setup is intentionally one-shot; data updates use syncRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webglMissing]);

  React.useEffect(() => {
    syncRef.current?.(users);
  }, [users]);

  // Theme flips recolor the landmass in place — the scene stays mounted.
  React.useEffect(() => {
    const palette = isDarkTheme ? GLOBE_COLORS.dark : GLOBE_COLORS.light;
    landMaterialRef.current?.color.set(palette.land);
    coastMaterialRef.current?.color.set(palette.coast);
  }, [isDarkTheme]);

  return (
    <div className={styles.wrap}>
      {webglMissing ? (
        <p className={styles.fallback}>
          Live globe is unavailable in this browser. {users.length} account
          {users.length === 1 ? "" : "s"} active now.
        </p>
      ) : (
        <div ref={mountRef} className={styles.canvas} aria-hidden="true" />
      )}

      {tooltip ? (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x, top: tooltip.y }}
          role="status"
        >
          <span className={styles.tooltipName}>{tooltip.user.fullName}</span>
          <span className={styles.tooltipRole}>
            {roleLabel(tooltip.user.role)}
            {tooltip.user.approximate ? " · approximate" : ""}
          </span>
          <span className={styles.tooltipMeta}>
            {[tooltip.user.city, tooltip.user.country].filter(Boolean).join(", ") ||
              "Location unavailable"}
          </span>
          <span className={styles.tooltipMeta}>
            IP {tooltip.user.ip ?? "not captured"}
          </span>
          <span className={styles.tooltipTime}>Active at {activeAt(tooltip.user.lastActiveAt)}</span>
        </div>
      ) : null}
    </div>
  );
}
